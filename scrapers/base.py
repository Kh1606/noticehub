"""
Shared scraper primitives.

Each per-site scraper lives in `scrapers/<region>/<site>.py` and exposes:

    SOURCE = SourceMeta(region=..., sub_entity=..., source_page=..., source_url=...)

    def scrape() -> list[Notice]:
        ...

The orchestrator (`scrapers/run_all.py`) imports each module, calls `scrape()`,
and writes the result through a Sink. Sinks are pluggable so the same scrapers
work locally (StdoutSink / JsonFileSink) and in CI (SupabaseSink, added later).
"""

from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Iterable, Protocol

import ssl

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
try:
    from urllib3.util.ssl_ import create_urllib3_context
    _HAS_URLLIB3_CTX = True
except ImportError:
    _HAS_URLLIB3_CTX = False

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}


@dataclass(frozen=True)
class SourceMeta:
    region: str
    sub_entity: str
    source_page: str
    source_url: str


@dataclass
class Notice:
    region: str
    sub_entity: str
    source_page: str
    source_url: str
    detail_url: str
    title: str
    posted_at: str | None = None  # ISO date "YYYY-MM-DD"
    notice_id: str = field(init=False)
    scraped_at: str = field(init=False)

    def __post_init__(self):
        self.notice_id = hashlib.sha1(self.detail_url.encode("utf-8")).hexdigest()
        self.scraped_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def asdict(self) -> dict:
        return asdict(self)


class _LegacySSLAdapter(HTTPAdapter):
    """Allow older TLS/cipher suites rejected by modern OpenSSL defaults.

    Uses TLSv1 minimum + SECLEVEL=0 to reach Korean gov sites that still
    run old TLS stacks (e.g. gangneung.go.kr, sokcho.go.kr, jbdc.co.kr).
    """

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.set_ciphers("ALL:@SECLEVEL=0")
        if hasattr(ssl, "OP_LEGACY_SERVER_CONNECT"):
            ctx.options |= ssl.OP_LEGACY_SERVER_CONNECT
        try:
            ctx.minimum_version = ssl.TLSVersion.TLSv1
        except AttributeError:
            pass
        kwargs["ssl_context"] = ctx
        super().init_poolmanager(*args, **kwargs)

    def send(self, request, **kw):
        kw.setdefault("verify", False)
        return super().send(request, **kw)


def _legacy_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    adapter = _LegacySSLAdapter()
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


def ssl_get(url: str, **kw) -> requests.Response:
    """GET with legacy TLS for sites that reject modern cipher/handshake."""
    r = _legacy_session().get(url, timeout=20, **kw)
    r.raise_for_status()
    return r


def get(url: str, *, session: requests.Session | None = None, **kw) -> requests.Response:
    """GET wrapper with sensible defaults; per-site can pass extra cookies/headers."""
    s = session or requests
    headers = {**DEFAULT_HEADERS, **kw.pop("headers", {})}
    r = s.get(url, timeout=20, headers=headers, verify=False, **kw)
    r.raise_for_status()
    return r


def soup(html: str | bytes) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


# Common Korean date formats observed across these sites:
# "2026-04-30", "2026.04.30", "2026.4.30.", "2026/04/30", "26.04.30"
_DATE_PATTERNS = [
    re.compile(r"(?P<y>20\d{2})[-./\s](?P<m>\d{1,2})[-./\s](?P<d>\d{1,2})"),
    re.compile(r"(?P<y>\d{2})\.(?P<m>\d{1,2})\.(?P<d>\d{1,2})"),
]


def parse_date(s: str | None) -> str | None:
    """Best-effort: extract first plausible YYYY-MM-DD from a string."""
    if not s:
        return None
    for pat in _DATE_PATTERNS:
        m = pat.search(s)
        if not m:
            continue
        y = int(m["y"])
        if y < 100:
            y += 2000
        try:
            return f"{y:04d}-{int(m['m']):02d}-{int(m['d']):02d}"
        except ValueError:
            continue
    return None


def clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


# ── Sinks ─────────────────────────────────────────────────────────────────

class Sink(Protocol):
    def write(self, notices: Iterable[Notice]) -> int: ...


class StdoutSink:
    """Pretty-print to stdout for local dev / debugging."""

    def write(self, notices: Iterable[Notice]) -> int:
        n = 0
        for x in notices:
            n += 1
            date = x.posted_at or "    -    "
            print(f"  [{date}] {x.title[:80]}")
            print(f"           → {x.detail_url}")
        return n


class JsonFileSink:
    """Append all notices to a single JSON file (used for local snapshot)."""

    def __init__(self, path):
        from pathlib import Path
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._buf: list[dict] = []

    def write(self, notices: Iterable[Notice]) -> int:
        items = [n.asdict() for n in notices]
        self._buf.extend(items)
        return len(items)

    def flush(self):
        import json
        self.path.write_text(
            json.dumps(self._buf, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


class SupabaseSink:
    """Upserts notices into the `notices_v2` table using the SECRET key.

    Requires env vars:
        SUPABASE_URL          (e.g. https://abc.supabase.co)
        SUPABASE_SECRET_KEY   (the sb_secret_... key — never commit)

    Uses notice_id (sha1 of detail_url) as the upsert conflict key, so
    re-running the scraper is idempotent: same URL → same row, no dupes.
    """

    def __init__(self, url: str, secret_key: str, table: str = "notices_v2"):
        from supabase import create_client
        self.client = create_client(url, secret_key)
        self.table = table

    def write(self, notices: Iterable[Notice]) -> int:
        # Deduplicate by notice_id — some boards show pinned notices twice
        seen: dict[str, dict] = {}
        for n in notices:
            seen[n.notice_id] = n.asdict()
        rows = list(seen.values())
        if not rows:
            return 0
        self.client.table(self.table).upsert(rows, on_conflict="notice_id").execute()
        return len(rows)


# Polite default delay between sites
def polite_sleep(seconds: float = 1.0):
    time.sleep(seconds)
