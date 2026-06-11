"""
One-off utility — download a logo/favicon for every organization in
regions.json, save as `public/icons/{slug}.png`, and emit a
`src/data/orgIcons.js` name→path mapping.

Strategy:
  1. Walk regions.json → unique list of subEntity names (~76).
  2. For each, pick sources[0].url → urlparse → host.
  3. Try Google's favicon service:
         https://www.google.com/s2/favicons?domain={host}&sz=128
     This is the workhorse — works for >90% of Korean gov sites in
     practice.
  4. Fall back to the site's own /favicon.ico (verify=False; Korean
     gov sites with broken cert chains). On TLS handshake failure
     route through scrapers.base.ssl_get — same legacy-SSL adapter
     the warmer uses.
  5. If both fail, write a 1×1 transparent placeholder and log the
     org to scripts/_org_icon_misses.md so it can be manually fixed.

Filename: ASCII slug of the organization name. Korean syllables are
romanized via `hangul-romanize`; falls back to md5 suffix if the
romanizer can't produce anything (shouldn't happen for these names).

Usage:
  python scripts/download_org_icons.py                # missing-only
  python scripts/download_org_icons.py --refresh      # re-download all
  python scripts/download_org_icons.py --only=서울    # subset
  python scripts/download_org_icons.py --workers=12   # change concurrency
  python scripts/download_org_icons.py --no-fallback  # skip /favicon.ico hop
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests
from urllib.parse import urljoin

# Reuse the legacy SSL adapter already shipped for Korean gov sites
# (yongin.go.kr / gm.go.kr / gmcc.co.kr — incomplete cert chains).
# This is a READ from the scrapers module — we don't modify any scraper logic.
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
try:
    from scrapers.base import ssl_get  # type: ignore
except Exception:  # pragma: no cover — script is one-off
    ssl_get = None  # fallback fetcher unavailable; script still runs

try:
    from hangul_romanize import Transliter
    from hangul_romanize.rule import academic
    _TRANSLIT = Transliter(academic)
except ImportError:
    _TRANSLIT = None

REGIONS_JSON = ROOT / "src" / "data" / "regions.json"
ICONS_DIR = ROOT / "public" / "icons"
ORG_ICONS_JS = ROOT / "src" / "data" / "orgIcons.js"
MISSES_MD = HERE / "_org_icon_misses.md"

GOOGLE_FAVICON = "https://www.google.com/s2/favicons?domain={host}&sz=128"

# 1×1 transparent PNG (67 bytes) — written when both Google and the
# direct /favicon.ico path failed. UI's <OrgIcon> component (Phase B)
# will detect the placeholder and render the first-letter circle
# instead. We still produce a file so the import map stays complete.
PLACEHOLDER_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c63f8cfc0c0c0c01f000505010134301a290000000049454e44ae426082"
)

# Google's "no icon found" generic globe. Two distinct returns in the
# wild — both small (~150–300 bytes) and identical across hosts.
GOOGLE_GLOBE_MD5S = {
    "3ca64f83fdcf25135d87e08af65e68c9",  # documented placeholder
    # We also use a size threshold (see is_google_globe).
}

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "image/png,image/*,*/*;q=0.8",
}

TIMEOUT = 15


# ─── slug helpers ──────────────────────────────────────────────────────────
def _romanize(text: str) -> str:
    """Korean → Latin transliteration. Returns '' on failure."""
    if not _TRANSLIT:
        return ""
    try:
        out = _TRANSLIT.translit(text)
        return out or ""
    except Exception:
        return ""


def slugify(name: str) -> str:
    """Org name → safe filename stem.

    Strategy: romanize Hangul → lowercase → strip diacritics → keep
    [a-z0-9] and word boundaries → join with hyphens. If the result is
    empty (extremely unlikely), fall back to an md5-prefixed slug so
    every org still gets a deterministic name.
    """
    s = _romanize(name) or name
    # Normalize accented Latin (e.g. "üç" → "uc")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    # Replace anything not a-z0-9 with a space, then collapse to hyphens
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = s.strip()
    s = re.sub(r"\s+", "-", s)
    if not s:
        h = hashlib.md5(name.encode("utf-8")).hexdigest()[:10]
        s = f"org-{h}"
    return s


# ─── icon fetching ─────────────────────────────────────────────────────────
def host_for(url: str) -> Optional[str]:
    try:
        p = urlparse(url)
        return p.hostname
    except Exception:
        return None


def is_google_globe(blob: bytes) -> bool:
    """Heuristic — Google's 'no favicon found' generic globe is tiny."""
    if not blob:
        return True
    if hashlib.md5(blob).hexdigest() in GOOGLE_GLOBE_MD5S:
        return True
    # Their fallback also tends to be < 300 bytes (16×16). Real
    # 128×128 icons are usually 2–10 KB.
    if len(blob) < 300:
        return True
    return False


def looks_like_image(blob: bytes) -> bool:
    """Sniff a few common image magic numbers."""
    if not blob or len(blob) < 8:
        return False
    return (
        blob.startswith(b"\x89PNG\r\n\x1a\n")          # PNG
        or blob.startswith(b"GIF87a") or blob.startswith(b"GIF89a")
        or blob[:3] == b"\xff\xd8\xff"                 # JPEG
        or blob[:2] == b"\x00\x00" and blob[2:4] in (b"\x01\x00", b"\x02\x00")  # ICO
        or blob[:4] == b"<svg" or b"<svg" in blob[:200]
    )


# Korean compound public suffixes — for `announce.incheon.go.kr` we want
# to also try the apex `incheon.go.kr` (Google's index is keyed on apex
# domains, not subdomains).
KR_COMPOUND_SUFFIXES = ("go.kr", "or.kr", "ac.kr", "co.kr", "ne.kr", "re.kr")


def host_variants(host: str) -> list[str]:
    """Yield host candidates to try, in priority order. Original first
    (best signal), then www-toggled, then registrable apex for Korean
    compound TLDs, then generic 2-part TLD."""
    variants = [host]
    if host.startswith("www."):
        variants.append(host[4:])
    else:
        variants.append("www." + host)
    # Apex extraction for .go.kr / .or.kr etc.
    for sfx in KR_COMPOUND_SUFFIXES:
        if host.endswith("." + sfx) and host != sfx:
            stem = host[: -(len(sfx) + 1)]
            parts = stem.split(".")
            if len(parts) > 1:
                apex = parts[-1] + "." + sfx
                variants.append(apex)
                variants.append("www." + apex)
            break
    else:
        # Generic .com/.net/.org → last two parts as apex
        parts = host.split(".")
        if len(parts) > 2:
            apex = ".".join(parts[-2:])
            variants.append(apex)
            variants.append("www." + apex)
    # Dedupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def fetch_google(host: str) -> Optional[bytes]:
    """Try Google's favicon service on the host, then on host variants
    (www-toggle, apex). Returns the first response that passes the
    'looks like a real icon' check."""
    for h in host_variants(host):
        try:
            r = requests.get(
                GOOGLE_FAVICON.format(host=h),
                headers=DEFAULT_HEADERS,
                timeout=TIMEOUT,
                allow_redirects=True,
            )
            if not r.ok:
                continue
            blob = r.content
            if blob and not is_google_globe(blob) and looks_like_image(blob):
                return blob
        except Exception:
            pass
    return None


def fetch_direct_favicon(host: str) -> Optional[bytes]:
    """Try https://{host}/favicon.ico then http://{host}/favicon.ico,
    with a TLS-handshake fallback through ssl_get for known-broken
    Korean gov certs."""
    for scheme in ("https", "http"):
        url = f"{scheme}://{host}/favicon.ico"
        try:
            r = requests.get(
                url,
                headers=DEFAULT_HEADERS,
                timeout=TIMEOUT,
                allow_redirects=True,
                verify=False,
            )
            if r.ok and looks_like_image(r.content):
                return r.content
        except requests.exceptions.SSLError:
            if ssl_get is not None:
                try:
                    r = ssl_get(url, headers=DEFAULT_HEADERS)
                    if r.ok and looks_like_image(r.content):
                        return r.content
                except Exception:
                    pass
        except requests.exceptions.ConnectionError as e:
            msg = str(e).lower()
            if ssl_get is not None and any(k in msg for k in ("ssl", "tls", "handshake")):
                try:
                    r = ssl_get(url, headers=DEFAULT_HEADERS)
                    if r.ok and looks_like_image(r.content):
                        return r.content
                except Exception:
                    pass
        except Exception:
            pass
    return None


# Match <link rel="icon" ... href="..."> in any order, captures the href.
# Two patterns since rel and href can swap order.
_HEAD_ICON_RES = [
    re.compile(
        r'<link\b[^>]*\brel\s*=\s*["\']?(?:shortcut\s+icon|icon|apple-touch-icon[^"\'>\s]*)["\']?[^>]*\bhref\s*=\s*["\']([^"\']+)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<link\b[^>]*\bhref\s*=\s*["\']([^"\']+)["\'][^>]*\brel\s*=\s*["\']?(?:shortcut\s+icon|icon|apple-touch-icon[^"\'>\s]*)["\']?',
        re.IGNORECASE,
    ),
]


# Many Korean gov sites' "/" returns a tiny redirect stub:
#   <meta http-equiv="refresh" content="0;url=https://.../www/index.do">
#   <script>location.href = 'https://.../main/vy';</script>
# Detect those and follow once so the head parser actually sees the real page.
_META_REFRESH_RE = re.compile(
    r'<meta[^>]+http-equiv\s*=\s*["\']?refresh["\']?[^>]+content\s*=\s*["\'][^"\']*?url\s*=\s*([^"\']+)["\']',
    re.IGNORECASE,
)
_LOCATION_HREF_RE = re.compile(
    r'location\s*(?:\.href|\.replace\s*\(|=)\s*[=\(]?\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _safe_get(url: str) -> Optional[requests.Response]:
    """GET with TLS-handshake fallback through ssl_get (Korean gov certs)."""
    try:
        return requests.get(
            url, headers=DEFAULT_HEADERS, timeout=TIMEOUT,
            verify=False, allow_redirects=True,
        )
    except requests.exceptions.SSLError:
        if ssl_get is not None:
            try:
                return ssl_get(url, headers=DEFAULT_HEADERS)
            except Exception:
                return None
        return None
    except requests.exceptions.ConnectionError as e:
        msg = str(e).lower()
        if ssl_get is not None and any(k in msg for k in ("ssl", "tls", "handshake")):
            try:
                return ssl_get(url, headers=DEFAULT_HEADERS)
            except Exception:
                return None
        return None
    except Exception:
        return None


def _resolve_redirect(text: str, base_url: str) -> Optional[str]:
    """Find a client-side redirect target in the HTML body (meta-refresh
    or location.href). Returns the absolute URL or None."""
    if not text:
        return None
    snippet = text[:5000]
    m = _META_REFRESH_RE.search(snippet)
    if m:
        return urljoin(base_url, m.group(1).strip())
    m = _LOCATION_HREF_RE.search(snippet)
    if m:
        target = m.group(1).strip()
        # Skip obvious non-URL hits (anchors, JS expressions)
        if target and not target.startswith(("javascript:", "#")):
            return urljoin(base_url, target)
    return None


def fetch_from_html_head(host: str) -> Optional[bytes]:
    """Last-resort: fetch the site root, scan <head> for <link rel='icon'>,
    fetch that href. Catches sites like www.goyang.go.kr that 404 on
    /favicon.ico but declare their icon path in HTML head. Follows one
    client-side redirect (meta-refresh / location.href) to handle gov
    sites whose '/' is a tiny stub that bounces to /www/index.do."""
    for scheme in ("https", "http"):
        url = f"{scheme}://{host}/"
        r = _safe_get(url)
        if r is None or not r.ok:
            continue

        text = r.text[:30000] if r.text else ""
        # Follow one client-side redirect if the initial response is a stub.
        if len(text) < 1500:
            redirect = _resolve_redirect(text, r.url)
            if redirect and redirect != r.url:
                r2 = _safe_get(redirect)
                if r2 is not None and r2.ok and r2.text:
                    r = r2
                    text = r.text[:30000]

        if not text:
            continue
        candidates: list[str] = []
        for pat in _HEAD_ICON_RES:
            for m in pat.finditer(text):
                candidates.append(m.group(1))
        # Dedupe + resolve relative URLs against the final page URL
        seen: set[str] = set()
        for href in candidates:
            if href in seen:
                continue
            seen.add(href)
            icon_url = urljoin(r.url, href.strip())
            rr = _safe_get(icon_url)
            if rr is not None and rr.ok and looks_like_image(rr.content) and len(rr.content) >= 200:
                return rr.content
    return None


def fetch_icon(host: str, *, no_fallback: bool) -> tuple[Optional[bytes], str]:
    """Returns (bytes, source_tag) where source_tag ∈ {'google', 'direct', 'html', ''}."""
    g = fetch_google(host)
    if g:
        return g, "google"
    if no_fallback:
        return None, ""
    d = fetch_direct_favicon(host)
    if d:
        return d, "direct"
    h = fetch_from_html_head(host)
    if h:
        return h, "html"
    return None, ""


# ─── orchestration ─────────────────────────────────────────────────────────
def load_orgs(only: Optional[str]) -> list[dict]:
    """Returns a list of {name, host, url}, deduped by name."""
    with open(REGIONS_JSON, encoding="utf-8") as f:
        data = json.load(f)
    seen: dict[str, dict] = {}
    for region in data:
        for sub in region.get("subEntities", []):
            name = sub.get("name")
            if not name:
                continue
            sources = sub.get("sources") or []
            if not sources:
                continue
            url = sources[0].get("url") or ""
            host = host_for(url)
            if not host:
                continue
            if only and only not in name:
                continue
            if name not in seen:
                seen[name] = {"name": name, "host": host, "url": url}
    return list(seen.values())


def write_atomic(path: Path, blob: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(blob)
    tmp.replace(path)


def warm_one(org: dict, *, refresh: bool, no_fallback: bool) -> dict:
    name = org["name"]
    host = org["host"]
    slug = slugify(name)
    out_path = ICONS_DIR / f"{slug}.png"

    if out_path.exists() and not refresh and out_path.stat().st_size > 70:
        # already have a real icon; skip
        return {"name": name, "host": host, "slug": slug, "source": "cached",
                "size": out_path.stat().st_size, "ok": True}

    blob, src = fetch_icon(host, no_fallback=no_fallback)
    if blob:
        write_atomic(out_path, blob)
        return {"name": name, "host": host, "slug": slug, "source": src,
                "size": len(blob), "ok": True}
    # Both paths failed → write placeholder so the filename slot is
    # filled. The misses report will tell the user to fix it manually.
    write_atomic(out_path, PLACEHOLDER_PNG)
    return {"name": name, "host": host, "slug": slug, "source": "placeholder",
            "size": len(PLACEHOLDER_PNG), "ok": False}


def emit_orgicons_js(results: list[dict]) -> None:
    """Write src/data/orgIcons.js — name → 'icons/slug.png' mapping.

    Placeholder entries (sites where every fetch layer failed) are
    intentionally OMITTED from the map so `iconFor()` returns null
    and the UI's <OrgIcon> falls through to its first-letter circle
    instead of rendering a 1×1 transparent dot. The placeholder PNG
    still exists on disk under the stable slug name, so manually
    dropping a real PNG into `public/icons/<slug>.png` and re-running
    the script picks it up automatically (file size > placeholder
    threshold → enters the map)."""
    # Sort by name for deterministic diffs.
    rows = sorted(results, key=lambda r: r["name"])
    # Filenames in the map should only point at files that actually
    # contain a real icon. We treat anything <= 100 bytes as missing
    # (the placeholder is 67B; some real icons start around 200B).
    def is_real(r: dict) -> bool:
        if r["source"] == "placeholder":
            return False
        path = ICONS_DIR / f"{r['slug']}.png"
        try:
            return path.stat().st_size > 100
        except OSError:
            return False

    real = [r for r in rows if is_real(r)]
    missing = [r for r in rows if not is_real(r)]

    lines = [
        "// AUTO-GENERATED by scripts/download_org_icons.py — do not edit by hand.",
        "// Maps subEntity (organization) name → public/icons/ path.",
        "// Run `python scripts/download_org_icons.py` to refresh.",
        "//",
        "// Organizations whose icon couldn't be auto-fetched are omitted from",
        "// ORG_ICON_MAP (their slugs are listed in MISSING_ICONS instead).",
        "// iconFor(name) returns null for those, so the UI's <OrgIcon> renders",
        "// a first-letter circle fallback. To fix one, drop a real PNG into",
        "// public/icons/<slug>.png and re-run the download script — the name",
        "// moves out of MISSING_ICONS and into ORG_ICON_MAP automatically.",
        "",
        "export const ORG_ICON_MAP = {",
    ]
    for r in real:
        key = json.dumps(r["name"], ensure_ascii=False)
        val = f"icons/{r['slug']}.png"
        lines.append(f"  {key}: {json.dumps(val)},")
    lines.append("}")
    lines.append("")
    lines.append("// Organizations currently using the placeholder PNG — kept here")
    lines.append("// for reference / so the UI can distinguish 'known missing' from")
    lines.append("// 'not in regions.json at all' if it ever wants to.")
    lines.append("export const MISSING_ICONS = new Set([")
    for r in missing:
        key = json.dumps(r["name"], ensure_ascii=False)
        lines.append(f"  {key},")
    lines.append("])")
    lines.append("")
    lines.append("// Resolve a name → fully-qualified URL respecting the Vite base path")
    lines.append("// ('/noticehub/' on GH Pages, '/' in dev). Returns null when the org")
    lines.append("// isn't in the map (either unknown or known-missing).")
    lines.append("export function iconFor(orgName) {")
    lines.append("  const path = ORG_ICON_MAP[orgName]")
    lines.append("  if (!path) return null")
    lines.append("  return import.meta.env.BASE_URL + path")
    lines.append("}")
    lines.append("")
    ORG_ICONS_JS.parent.mkdir(parents=True, exist_ok=True)
    ORG_ICONS_JS.write_text("\n".join(lines), encoding="utf-8")


def emit_misses_md(results: list[dict]) -> int:
    """Write scripts/_org_icon_misses.md listing fallbacks + placeholders.
    Returns the placeholder count."""
    placeholders = [r for r in results if r["source"] == "placeholder"]
    fallbacks = [r for r in results if r["source"] in ("direct", "html")]
    lines = [
        "# Organization icons — manual review",
        "",
        "Auto-generated by `scripts/download_org_icons.py`.",
        "These orgs ended up with a non-ideal icon. Filenames are stable —",
        "just drop a better PNG into `public/icons/<slug>.png` to replace.",
        "",
        f"## ❌ Placeholders ({len(placeholders)}) — no icon found",
        "",
    ]
    if placeholders:
        lines.append("| Org | Host | File |")
        lines.append("|---|---|---|")
        for r in sorted(placeholders, key=lambda x: x["name"]):
            lines.append(f"| {r['name']} | `{r['host']}` | `public/icons/{r['slug']}.png` |")
    else:
        lines.append("_None — every org got at least a /favicon.ico._")
    lines += ["", f"## ⚠ Fallbacks ({len(fallbacks)}) — direct /favicon.ico instead of Google", ""]
    if fallbacks:
        lines.append("| Org | Host | File |")
        lines.append("|---|---|---|")
        for r in sorted(fallbacks, key=lambda x: x["name"]):
            lines.append(f"| {r['name']} | `{r['host']}` | `public/icons/{r['slug']}.png` |")
    else:
        lines.append("_None — Google answered for every org._")
    lines.append("")
    MISSES_MD.write_text("\n".join(lines), encoding="utf-8")
    return len(placeholders)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true",
                    help="Re-download icons that already exist on disk")
    ap.add_argument("--only", help="Substring filter on org name (e.g. '서울')")
    ap.add_argument("--workers", type=int, default=8,
                    help="Concurrent fetches (default 8)")
    ap.add_argument("--no-fallback", action="store_true",
                    help="Skip the direct /favicon.ico fallback hop")
    args = ap.parse_args()

    # Silence the InsecureRequestWarning since we're intentionally verify=False
    try:
        import urllib3
        urllib3.disable_warnings()
    except Exception:
        pass

    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    orgs = load_orgs(only=args.only)
    if not orgs:
        print("No orgs matched.", file=sys.stderr)
        return 1
    print(f"Targeting {len(orgs)} organizations.")
    if _TRANSLIT is None:
        print("  (hangul-romanize not installed — slugs will use md5 fallback)")

    results: list[dict] = []
    counts = {"google": 0, "direct": 0, "html": 0, "cached": 0, "placeholder": 0}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {
            ex.submit(warm_one, org, refresh=args.refresh, no_fallback=args.no_fallback): org
            for org in orgs
        }
        for i, fut in enumerate(as_completed(futures), 1):
            org = futures[fut]
            try:
                res = fut.result()
            except Exception as e:
                res = {"name": org["name"], "host": org["host"],
                       "slug": slugify(org["name"]), "source": "placeholder",
                       "size": 0, "ok": False, "error": str(e)}
                # also stamp a placeholder so the JS map stays consistent
                write_atomic(ICONS_DIR / f"{res['slug']}.png", PLACEHOLDER_PNG)
            results.append(res)
            counts[res["source"]] = counts.get(res["source"], 0) + 1
            badge = {
                "google": "✅",
                "cached": "·",
                "direct": "⚠",
                "html": "🔍",
                "placeholder": "❌",
            }.get(res["source"], "?")
            print(
                f"  [{i:>3}/{len(orgs)}] {badge} "
                f"{res['name'][:24]:<24} "
                f"{res['slug'][:30]:<30} "
                f"{res['source']:<11} "
                f"{res['size']:>5}B"
            )

    emit_orgicons_js(results)
    missing = emit_misses_md(results)

    print()
    print(
        f"Done. google={counts.get('google',0)} "
        f"direct={counts.get('direct',0)} "
        f"html={counts.get('html',0)} "
        f"cached={counts.get('cached',0)} "
        f"placeholder={counts.get('placeholder',0)}"
    )
    print(f"Wrote: {ORG_ICONS_JS.relative_to(ROOT)}")
    print(f"Wrote: {MISSES_MD.relative_to(ROOT)}")
    print(f"Icons in: {ICONS_DIR.relative_to(ROOT)}/  ({len(results)} files)")
    if missing:
        print(f"\nReview the {missing} placeholder(s) in {MISSES_MD.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
