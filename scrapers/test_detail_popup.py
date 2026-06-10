"""
QA script: exercise the fetch-notice-detail Edge Function across all
(region, sub_entity) pairs we have notices for, and write a markdown
report so you can spot which sources are broken.

Run from the repo root (needs `.env` with SUPABASE_URL + SUPABASE_SECRET_KEY):
    python -m scrapers.test_detail_popup
    python -m scrapers.test_detail_popup --only=경기도
    python -m scrapers.test_detail_popup --limit=20

The script:
  • Loads .env
  • Pages through notices_v2 (Supabase's 1000-row cap workaround) and
    picks the most-recent notice per (region, sub_entity).
  • For each one, POSTs to {SUPABASE_URL}/functions/v1/fetch-notice-detail
    with {notice_id, detail_url}. Edge Function must be deployed with
    verify_jwt = false (no auth header needed).
  • Tabulates: status, attachments count, body length, elapsed ms.
  • Writes a markdown report (clt+_qa_popup_report.md by default) with
    a summary at top and a sortable per-row table.
  • Also prints summary to stdout.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def page_all_notices(client) -> list[dict[str, Any]]:
    """Fetch all notices_v2 rows (paging past the 1000-row PostgREST cap)."""
    PAGE = 1000
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        res = client.table("notices_v2") \
            .select("notice_id,region,sub_entity,source_page,detail_url,posted_at,scraped_at") \
            .order("scraped_at", desc=True) \
            .range(start, start + PAGE - 1) \
            .execute()
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        start += PAGE
    return rows


def most_recent_per_pair(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return a deduplicated list: one row per (region, sub_entity), most-recent first."""
    seen: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows:
        key = (r.get("region") or "", r.get("sub_entity") or "")
        if key not in seen:
            seen[key] = r
    out = list(seen.values())
    out.sort(key=lambda r: (r.get("region") or "", r.get("sub_entity") or ""))
    return out


def invoke_edge_function(supabase_url: str, anon_key: str | None, payload: dict) -> tuple[int, dict | str, float]:
    """POST to fetch-notice-detail. Returns (status_code, json_or_text, elapsed_ms)."""
    url = supabase_url.rstrip("/") + "/functions/v1/fetch-notice-detail"
    headers = {"Content-Type": "application/json"}
    # Even with verify_jwt=false, Supabase's gateway sometimes requires an
    # apikey header. Include it if we have one; harmless if not needed.
    if anon_key:
        headers["apikey"] = anon_key
        headers["Authorization"] = f"Bearer {anon_key}"
    t0 = time.time()
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        elapsed = (time.time() - t0) * 1000
        try:
            body = r.json()
        except Exception:
            body = r.text[:500]
        return r.status_code, body, elapsed
    except requests.RequestException as e:
        elapsed = (time.time() - t0) * 1000
        return 0, f"{type(e).__name__}: {str(e)[:200]}", elapsed


def classify(http_status: int, body: Any) -> tuple[str, int, int, str | None]:
    """Map an Edge Function response to (label, attachments_count, body_chars, error)."""
    if http_status == 0 or http_status >= 500:
        return "❌ ERR", 0, 0, f"transport: {body!s}" if not isinstance(body, dict) else f"HTTP {http_status}"
    if not isinstance(body, dict):
        return "❌ ERR", 0, 0, f"non-JSON: {str(body)[:120]}"
    if http_status != 200:
        return "❌ ERR", 0, 0, f"HTTP {http_status}: {body.get('error', '')}"
    if body.get("status") == "error":
        return "❌ FETCH", 0, 0, body.get("error_text") or "source fetch failed"
    atts = body.get("attachments") or []
    body_text = body.get("body_text") or ""
    has_atts = len(atts) > 0
    has_body = len(body_text) >= 80
    if has_atts and has_body:
        return "✅ FULL", len(atts), len(body_text), None
    if has_atts:
        return "⚠ NO_BODY", len(atts), len(body_text), None
    if has_body:
        return "⚠ NO_ATTS", 0, len(body_text), None
    return "⚠ EMPTY", 0, 0, None


def write_report(out_path: str, results: list[dict[str, Any]]) -> None:
    by_label = defaultdict(int)
    for r in results:
        by_label[r["label"]] += 1
    total = len(results)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines: list[str] = []
    lines.append(f"# Notice-popup QA report — {now}\n")
    lines.append(f"Tested **{total}** sources (one most-recent notice per region · sub_entity).\n\n")

    lines.append("## Summary\n")
    lines.append("| Outcome | Count |")
    lines.append("|---|---:|")
    for label in ["✅ FULL", "⚠ NO_BODY", "⚠ NO_ATTS", "⚠ EMPTY", "❌ FETCH", "❌ ERR"]:
        if by_label.get(label):
            lines.append(f"| {label} | {by_label[label]} |")
    lines.append("")
    lines.append("Legend: **FULL** = body + ≥1 attachment · **NO_BODY** = attachments but no body · **NO_ATTS** = body but no files · **EMPTY** = ok response but neither · **FETCH** = Edge Function fetched but source page errored · **ERR** = invocation failed.\n")

    lines.append("\n## Per-source result\n")
    lines.append("| Result | Region | 기관 | 페이지 | files | body chars | ms | notice_id |")
    lines.append("|---|---|---|---|---:|---:|---:|---|")
    # Sort: errors first, then no_body, then no_atts, then empty, then ok
    order = {"❌ ERR": 0, "❌ FETCH": 1, "⚠ EMPTY": 2, "⚠ NO_BODY": 3, "⚠ NO_ATTS": 4, "✅ FULL": 5}
    results_sorted = sorted(results, key=lambda r: (order.get(r["label"], 9), r["region"], r["sub_entity"]))
    for r in results_sorted:
        lines.append(
            f"| {r['label']} | {r['region']} | {r['sub_entity']} | {r['source_page']} | "
            f"{r['attachments']} | {r['body_chars']} | {int(r['elapsed_ms'])} | `{r['notice_id'][:14]}…` |"
        )

    # Append error details at the bottom
    errs = [r for r in results_sorted if r["label"].startswith("❌")]
    if errs:
        lines.append("\n## Errors (full text)\n")
        for r in errs:
            lines.append(f"- **{r['region']} / {r['sub_entity']} / {r['source_page']}** — {r['label']}")
            lines.append(f"  - notice_id: `{r['notice_id']}`")
            lines.append(f"  - detail_url: {r['detail_url']}")
            lines.append(f"  - error: `{r['error']}`")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="Filter to a region substring (e.g. 경기도)")
    ap.add_argument("--limit", type=int, help="Cap on number of sources tested")
    ap.add_argument("--out", default="clt+_qa_popup_report.md", help="Markdown report path")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    secret = os.environ.get("SUPABASE_SECRET_KEY")
    # Anon key is optional — only needed if your project requires apikey
    # header even on verify_jwt=false functions.
    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not url or not secret:
        print("ERROR: SUPABASE_URL + SUPABASE_SECRET_KEY required in env (.env)", file=sys.stderr)
        sys.exit(2)

    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: `supabase` python lib not installed. Run: pip install -r scrapers/requirements.txt", file=sys.stderr)
        sys.exit(2)

    client = create_client(url, secret)

    print("Fetching notices_v2…")
    all_rows = page_all_notices(client)
    print(f"  total rows: {len(all_rows):,}")
    by_pair = most_recent_per_pair(all_rows)
    print(f"  unique (region, sub_entity) pairs: {len(by_pair)}")

    if args.only:
        before = len(by_pair)
        by_pair = [r for r in by_pair if args.only in (r.get("region") or "")]
        print(f"  filtered by region~'{args.only}': {len(by_pair)} / {before}")
    if args.limit:
        by_pair = by_pair[: args.limit]
        print(f"  limited to first {args.limit}")

    print(f"\nInvoking Edge Function for {len(by_pair)} sources...\n")
    results = []
    for i, r in enumerate(by_pair, 1):
        notice_id = r["notice_id"]
        detail_url = r["detail_url"]
        payload = {"notice_id": notice_id, "detail_url": detail_url}
        http, body, elapsed = invoke_edge_function(url, anon, payload)
        label, atts, bchars, err = classify(http, body)
        print(
            f"  [{i:>3}/{len(by_pair)}] {label:<10} "
            f"{(r.get('region') or '')[:10]:<10} "
            f"{(r.get('sub_entity') or '')[:18]:<18} "
            f"files={atts:>2} body={bchars:>4} {int(elapsed):>5}ms"
        )
        results.append({
            "notice_id": notice_id,
            "region": r.get("region") or "—",
            "sub_entity": r.get("sub_entity") or "—",
            "source_page": r.get("source_page") or "—",
            "detail_url": detail_url,
            "label": label,
            "attachments": atts,
            "body_chars": bchars,
            "elapsed_ms": elapsed,
            "error": err,
        })

    write_report(args.out, results)
    print(f"\n✔ Report written → {args.out}")
    print(f"  Summary: " + " · ".join(
        f"{k}:{v}" for k, v in sorted(
            {r['label']: sum(1 for x in results if x['label'] == r['label']) for r in results}.items()
        )
    ))


if __name__ == "__main__":
    main()
