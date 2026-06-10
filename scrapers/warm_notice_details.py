"""
Cache warmer for notice_details.

Finds notices_v2 rows whose detail page hasn't been parsed yet (or whose
v1 cache lacks body_text), fetches each in parallel, extracts body +
attachments via scrapers/_helpers/notice_detail_extract.py, and upserts
into notice_details. Once a notice is warmed, opening it in the popup
is an instant cache hit — no Edge Function fetch.

Usage:
  python -m scrapers.warm_notice_details                 # backfill everything missing
  python -m scrapers.warm_notice_details --only=경기도   # subset by region
  python -m scrapers.warm_notice_details --limit=50      # cap on rows tried
  python -m scrapers.warm_notice_details --workers=12    # change concurrency
  python -m scrapers.warm_notice_details --refresh-all   # ignore existing cache

Required env (loaded from .env):
  SUPABASE_URL
  SUPABASE_SECRET_KEY   (service_role — bypasses RLS so we can upsert)
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from scrapers._helpers.notice_detail_extract import extract_detail

PAGE = 1000
TIMEOUT = 20


def page_all_notices(client, only: str | None) -> list[dict[str, Any]]:
    """Page through notices_v2, returning the most-recent row per (region, sub_entity)."""
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        res = (
            client.table("notices_v2")
            .select("notice_id,region,sub_entity,source_page,detail_url,scraped_at")
            .order("scraped_at", desc=True)
            .range(start, start + PAGE - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        start += PAGE
    if only:
        rows = [r for r in rows if only in (r.get("region") or "")]
    return rows


def already_cached_ids(client) -> set[str]:
    """notice_ids whose cache row has status=ok AND body_text NOT NULL."""
    out: set[str] = set()
    start = 0
    while True:
        res = (
            client.table("notice_details")
            .select("notice_id")
            .eq("status", "ok")
            .not_.is_("body_text", "null")
            .range(start, start + PAGE - 1)
            .execute()
        )
        batch = res.data or []
        out.update(r["notice_id"] for r in batch)
        if len(batch) < PAGE:
            break
        start += PAGE
    return out


def decode_html(resp: requests.Response) -> str:
    """Return HTML text, respecting EUC-KR when the server declares it."""
    ctype = (resp.headers.get("content-type") or "").lower()
    if "euc-kr" in ctype:
        try:
            return resp.content.decode("euc-kr", errors="replace")
        except Exception:
            pass
    # requests sometimes mis-detects when the server omits the charset; try
    # apparent_encoding which uses chardet.
    if resp.encoding and resp.encoding.lower() in {"iso-8859-1", "ascii"}:
        try:
            return resp.content.decode(resp.apparent_encoding or "utf-8", errors="replace")
        except Exception:
            pass
    return resp.text


def warm_one(notice: dict[str, Any]) -> dict[str, Any]:
    """Fetch + extract for one notice. Returns a result dict for the caller to upsert."""
    detail_url = notice["detail_url"]
    notice_id = notice["notice_id"]
    t0 = time.time()
    try:
        r = requests.get(
            detail_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/126.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
            },
            timeout=TIMEOUT,
            allow_redirects=True,
            verify=False,  # many Korean gov sites have stale TLS chains
        )
        if not r.ok:
            return {
                "notice_id": notice_id,
                "status": "error",
                "error_text": f"HTTP {r.status_code}",
                "body_text": None,
                "attachments": [],
                "elapsed_ms": (time.time() - t0) * 1000,
            }
        html = decode_html(r)
        out = extract_detail(html, str(r.url))
        return {
            "notice_id": notice_id,
            "status": "ok",
            "error_text": None,
            "body_text": out["body_text"] or None,
            "attachments": out["attachments"],
            "elapsed_ms": (time.time() - t0) * 1000,
        }
    except requests.RequestException as e:
        return {
            "notice_id": notice_id,
            "status": "error",
            "error_text": f"{type(e).__name__}: {str(e)[:200]}",
            "body_text": None,
            "attachments": [],
            "elapsed_ms": (time.time() - t0) * 1000,
        }
    except Exception as e:
        return {
            "notice_id": notice_id,
            "status": "error",
            "error_text": f"{type(e).__name__}: {str(e)[:200]}",
            "body_text": None,
            "attachments": [],
            "elapsed_ms": (time.time() - t0) * 1000,
        }


def upsert(client, result: dict[str, Any]) -> None:
    client.table("notice_details").upsert(
        {
            "notice_id": result["notice_id"],
            "attachments": result["attachments"],
            "body_text": result["body_text"],
            "status": result["status"],
            "error_text": result["error_text"],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


def warm_missing(
    client,
    *,
    only: str | None = None,
    limit: int | None = None,
    workers: int = 8,
    refresh_all: bool = False,
    quiet: bool = False,
) -> dict[str, int]:
    """
    Warm every notice that hasn't been cached yet (or all of them if
    refresh_all=True). Returns a small summary dict so callers can report.
    """
    notices = page_all_notices(client, only=only)
    if not quiet:
        print(f"notices_v2 candidates: {len(notices):,}{f' (region~{only})' if only else ''}")

    cached_ids = set() if refresh_all else already_cached_ids(client)
    todo = [n for n in notices if n["notice_id"] not in cached_ids]
    if not quiet:
        print(f"already cached: {len(cached_ids):,}  →  to warm: {len(todo):,}")

    if limit:
        todo = todo[:limit]
        if not quiet:
            print(f"limited to first {limit}")

    if not todo:
        if not quiet:
            print("nothing to do.")
        return {"total": 0, "ok": 0, "err": 0, "no_body": 0, "no_atts": 0}

    counts = {"total": len(todo), "ok": 0, "err": 0, "no_body": 0, "no_atts": 0}
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(warm_one, n): n for n in todo}
        i = 0
        for fut in as_completed(futures):
            i += 1
            n = futures[fut]
            try:
                res = fut.result()
            except Exception as e:  # noqa: BLE001
                res = {
                    "notice_id": n["notice_id"],
                    "status": "error",
                    "error_text": f"{type(e).__name__}: {str(e)[:200]}",
                    "body_text": None,
                    "attachments": [],
                    "elapsed_ms": 0,
                }
            try:
                upsert(client, res)
            except Exception as e:  # noqa: BLE001
                if not quiet:
                    print(f"   (upsert failed for {res['notice_id']}: {e})", file=sys.stderr)

            if res["status"] == "ok":
                counts["ok"] += 1
                if not res["body_text"]:
                    counts["no_body"] += 1
                if not res["attachments"]:
                    counts["no_atts"] += 1
                if not quiet:
                    label = "✅" if (res["body_text"] and res["attachments"]) else "⚠"
                    print(
                        f"  [{i:>4}/{len(todo)}] {label} "
                        f"{(n.get('region') or '')[:8]:<8} "
                        f"{(n.get('sub_entity') or '')[:18]:<18} "
                        f"files={len(res['attachments']):>2} "
                        f"body={len(res['body_text'] or ''):>4} "
                        f"{int(res['elapsed_ms']):>5}ms"
                    )
            else:
                counts["err"] += 1
                if not quiet:
                    print(
                        f"  [{i:>4}/{len(todo)}] ❌ "
                        f"{(n.get('region') or '')[:8]:<8} "
                        f"{(n.get('sub_entity') or '')[:18]:<18} "
                        f"{res.get('error_text', '')[:80]}"
                    )

    if not quiet:
        elapsed = time.time() - t_start
        print(
            f"\nDone. {counts['ok']} ok ({counts['no_body']} w/o body, "
            f"{counts['no_atts']} w/o attachments), {counts['err']} errors "
            f"in {elapsed:.1f}s."
        )
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="Region substring filter (e.g. 경기도)")
    ap.add_argument("--limit", type=int, help="Cap on rows to warm")
    ap.add_argument("--workers", type=int, default=8, help="Concurrent fetchers (default 8)")
    ap.add_argument("--refresh-all", action="store_true", help="Ignore cache; re-fetch everything")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    secret = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not secret:
        print("ERROR: SUPABASE_URL + SUPABASE_SECRET_KEY required in env (.env)", file=sys.stderr)
        sys.exit(2)

    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: install scrapers deps first: pip install -r scrapers/requirements.txt", file=sys.stderr)
        sys.exit(2)

    # Silence the InsecureRequestWarning since we're intentionally verify=False
    try:
        import urllib3
        urllib3.disable_warnings()
    except Exception:
        pass

    client = create_client(url, secret)
    warm_missing(
        client,
        only=args.only,
        limit=args.limit,
        workers=args.workers,
        refresh_all=args.refresh_all,
    )


if __name__ == "__main__":
    main()
