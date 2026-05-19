"""
Monthly notices report emailer.

Runs on a GitHub Actions cron (1st of each month at 09:00 KST = 00:00 UTC).
Queries Supabase for the previous calendar month's data, builds:

  • HTML email body with summary tables
  • CSV attachment with raw per-source rows

Sends via Resend API. Required env vars:

  SUPABASE_URL          your project URL
  SUPABASE_SECRET_KEY   service_role key (bypasses RLS)
  RESEND_API_KEY        re_... key from resend.com
  ALERT_TO              comma-separated recipient list
  ALERT_FROM            FROM address (e.g. onboarding@resend.dev)

Run locally for testing:
  python -m scrapers.monthly_report
"""
from __future__ import annotations

import base64
import csv
import io
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from supabase import create_client


def previous_month_range(now_utc: datetime | None = None) -> tuple[datetime, datetime, str]:
    """Return (start_utc, end_utc, label) for the previous calendar month.

    Example: called May 1 2026 → returns Apr 1 → May 1 (UTC), label "2026-04".
    """
    now = now_utc or datetime.now(timezone.utc)
    first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_of_prev_month = first_of_this_month - timedelta(days=1)
    first_of_prev_month = last_of_prev_month.replace(day=1)
    label = f"{first_of_prev_month.year:04d}-{first_of_prev_month.month:02d}"
    return first_of_prev_month, first_of_this_month, label


def page_all(client, table: str, select: str, *, gte_col: str, gte: str, lt_col: str, lt: str):
    """Paged select to bypass PostgREST's default 1000-row cap."""
    PAGE = 1000
    rows = []
    start = 0
    while True:
        q = client.table(table).select(select) \
            .gte(gte_col, gte).lt(lt_col, lt) \
            .range(start, start + PAGE - 1)
        res = q.execute()
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        start += PAGE
    return rows


def build_stats(notices: list[dict], errors: list[dict], prev_total: int | None):
    total = len(notices)
    by_region = Counter()
    by_sub = Counter()
    for n in notices:
        by_region[n.get("region") or "—"] += 1
        by_sub[f"{n.get('region') or '—'} / {n.get('sub_entity') or '—'}"] += 1

    errors_by_code = Counter()
    errors_by_sub = Counter()
    for e in errors:
        errors_by_code[e.get("status_code") or 0] += 1
        errors_by_sub[f"{e.get('region') or '—'} / {e.get('sub_entity') or '—'}"] += 1

    delta_pct = None
    if prev_total is not None and prev_total > 0:
        delta_pct = (total - prev_total) / prev_total * 100.0

    return {
        "total": total,
        "by_region": by_region.most_common(),
        "top_sources": by_sub.most_common(10),
        "errors_total": len(errors),
        "errors_by_code": sorted(errors_by_code.items()),
        "errors_by_sub": errors_by_sub.most_common(10),
        "prev_total": prev_total,
        "delta_pct": delta_pct,
    }


def html_body(label: str, stats: dict) -> str:
    def row(left, right, *, b=False, color=None):
        style = f"padding:6px 12px 6px 0"
        if color:
            style += f";color:{color}"
        right_html = f"<b>{right}</b>" if b else str(right)
        return f"<tr><td style='{style}'>{left}</td><td style='{style};text-align:right;font-variant-numeric:tabular-nums'>{right_html}</td></tr>"

    delta_html = ""
    if stats["delta_pct"] is not None:
        sign = "+" if stats["delta_pct"] >= 0 else ""
        color = "#059669" if stats["delta_pct"] >= 0 else "#DC2626"
        delta_html = (
            f"<span style='color:{color};font-weight:600;margin-left:6px'>"
            f"{sign}{stats['delta_pct']:.1f}% vs 전월</span>"
        )

    region_rows = "".join(row(r, f"{c:,}") for r, c in stats["by_region"])
    top_rows = "".join(row(n, f"{c:,}") for n, c in stats["top_sources"])
    err_rows = "".join(row(f"HTTP {code}", f"{c}") for code, c in stats["errors_by_code"])
    err_sub_rows = "".join(row(s, f"{c}") for s, c in stats["errors_by_sub"]) or "<tr><td colspan='2' style='padding:6px;color:#6B7280'>없음</td></tr>"

    return f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111827;max-width:680px">
  <div style="background:linear-gradient(180deg,#EFF6FF 0%,#F9FAFB 100%);padding:18px 22px;border-radius:10px;margin-bottom:18px">
    <div style="font-size:11px;font-weight:700;color:#2563EB;letter-spacing:.4px;text-transform:uppercase">CLT+ 월간 리포트</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px">{label} 스크래핑 요약</div>
  </div>

  <h3 style="font-size:14px;margin:18px 0 6px;color:#374151">전체</h3>
  <div style="font-size:32px;font-weight:700">{stats['total']:,}<span style='font-size:14px;font-weight:500;color:#6B7280;margin-left:6px'>건 수집{delta_html}</span></div>

  <h3 style="font-size:14px;margin:24px 0 6px;color:#374151">지역별</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
    {region_rows}
  </table>

  <h3 style="font-size:14px;margin:24px 0 6px;color:#374151">상위 10개 기관</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
    {top_rows}
  </table>

  <h3 style="font-size:14px;margin:24px 0 6px;color:#374151">스크래퍼 오류 — 총 {stats['errors_total']}건</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
    {err_rows or "<tr><td colspan='2' style='padding:6px;color:#6B7280'>없음</td></tr>"}
  </table>

  <h4 style="font-size:13px;margin:14px 0 6px;color:#6B7280">오류 발생 상위 기관</h4>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px">
    {err_sub_rows}
  </table>

  <div style="margin-top:30px;padding-top:14px;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280">
    상세 데이터는 첨부된 <code>clt-plus2-report-{label}.csv</code> 를 참고하세요.<br/>
    <a href="https://kh1606.github.io/clt-plus2/" style="color:#2563EB;text-decoration:none;font-weight:600">사이트로 이동</a>
  </div>
</div>
"""


def csv_attachment(notices: list[dict], errors: list[dict]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["__section__", "notices"])
    w.writerow(["region", "sub_entity", "source_page", "posted_at", "scraped_at", "title", "detail_url"])
    for n in notices:
        w.writerow([
            n.get("region") or "",
            n.get("sub_entity") or "",
            n.get("source_page") or "",
            n.get("posted_at") or "",
            n.get("scraped_at") or "",
            (n.get("title") or "").replace("\n", " "),
            n.get("detail_url") or "",
        ])
    w.writerow([])
    w.writerow(["__section__", "errors"])
    w.writerow(["region", "sub_entity", "source_page", "url_tried", "status_code", "error_text", "occurred_at"])
    for e in errors:
        w.writerow([
            e.get("region") or "",
            e.get("sub_entity") or "",
            e.get("source_page") or "",
            e.get("url_tried") or "",
            e.get("status_code") or "",
            (e.get("error_text") or "").replace("\n", " "),
            e.get("occurred_at") or "",
        ])
    # Excel-friendly UTF-8 BOM
    return ("﻿" + buf.getvalue()).encode("utf-8")


def send_email(api_key: str, to_list: list[str], from_addr: str, subject: str, html: str, csv_bytes: bytes, csv_name: str):
    payload = {
        "from": from_addr,
        "to": to_list,
        "subject": subject,
        "html": html,
        "attachments": [
            {
                "filename": csv_name,
                "content": base64.b64encode(csv_bytes).decode("ascii"),
            },
        ],
    }
    r = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if not r.ok:
        raise RuntimeError(f"Resend {r.status_code}: {r.text}")
    return r.json()


def main():
    url = os.environ.get("SUPABASE_URL")
    secret = os.environ.get("SUPABASE_SECRET_KEY")
    resend_key = os.environ.get("RESEND_API_KEY")
    to = (os.environ.get("ALERT_TO") or "").strip()
    from_addr = (os.environ.get("ALERT_FROM") or "onboarding@resend.dev").strip()

    missing = [k for k, v in [
        ("SUPABASE_URL", url),
        ("SUPABASE_SECRET_KEY", secret),
        ("RESEND_API_KEY", resend_key),
        ("ALERT_TO", to),
    ] if not v]
    if missing:
        print(f"ERROR: missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(2)

    to_list = [s.strip() for s in to.split(",") if s.strip()]

    start, end, label = previous_month_range()
    print(f"Report window: {start.isoformat()} → {end.isoformat()} ({label})")

    client = create_client(url, secret)

    # Notices for the previous month (use scraped_at as the time anchor)
    notices = page_all(
        client, "notices_v2",
        "region,sub_entity,source_page,posted_at,scraped_at,title,detail_url",
        gte_col="scraped_at", gte=start.isoformat(),
        lt_col="scraped_at", lt=end.isoformat(),
    )
    print(f"Notices fetched: {len(notices):,}")

    # Errors for the previous month
    errors = page_all(
        client, "scrape_errors",
        "region,sub_entity,source_page,url_tried,status_code,error_text,occurred_at",
        gte_col="occurred_at", gte=start.isoformat(),
        lt_col="occurred_at", lt=end.isoformat(),
    )
    print(f"Errors fetched: {len(errors):,}")

    # Previous-previous month total for delta comparison.
    # notices_v2's primary key is notice_id (sha1 composite), not "id".
    pprev_start, pprev_end, _ = previous_month_range(start)
    pprev_notices = page_all(
        client, "notices_v2",
        "notice_id",
        gte_col="scraped_at", gte=pprev_start.isoformat(),
        lt_col="scraped_at", lt=pprev_end.isoformat(),
    )
    prev_total = len(pprev_notices)
    print(f"Previous-previous month notices (for delta): {prev_total:,}")

    stats = build_stats(notices, errors, prev_total)
    body = html_body(label, stats)
    csv_bytes = csv_attachment(notices, errors)
    csv_name = f"clt-plus2-report-{label}.csv"

    print(f"Sending email to: {', '.join(to_list)} from: {from_addr}")
    result = send_email(
        resend_key,
        to_list,
        from_addr,
        f"[CLT+] {label} 월간 리포트 — 공지 {stats['total']:,}건, 오류 {stats['errors_total']}건",
        body,
        csv_bytes,
        csv_name,
    )
    print(f"Email sent. id={result.get('id')}")


if __name__ == "__main__":
    main()
