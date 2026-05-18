"""Generic scraper for Korean municipal sites that use the citynet
SAPGosiBizProcess.do board system.

Two flavors observed:
  - direct page (e.g. announce.incheon.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do?...)
  - embedded in an iframe from a parent (e.g. www.chungnam.go.kr/construction/...
    → minwon.chungnam.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do?...)

Row pattern (inside the largest list table):

  <tr onclick="viewData('SNO','GOSIGBN')">
    <td>가시번호</td>
    <td>제목</td>
    <td>담당부서</td>
    <td>YYYY-MM-DD</td>
    <td>조회수</td>
  </tr>

JS handler:
  function viewData(sno, gosiGbn) {
    frm.action = "/citynet/jsp/sap/SAPGosiBizProcess.do?command=searchDetail
                  &flag=gosiGL&svp=Y&sido=<sido>&sno=" + sno + "&gosiGbn=" + gosiGbn;
    frm.submit();   // POST
  }

We synthesize the detail URL as a GET-style URL pointing at the same
SAPGosiBizProcess endpoint with command=searchDetail. Even though the
server uses POST, the URL is unique per (sno, gosiGbn) and works as a
stable identifier.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from scrapers.base import Notice, SourceMeta, soup, clean, parse_date


def _detail_url(listing_url: str, sno: str, gosi_gbn: str) -> str:
    """Build a canonical detail URL from the listing URL params + sno/gosiGbn.
    Preserves sido, flag, svp from the listing URL when present."""
    sp = urlsplit(listing_url)
    qs = dict(parse_qsl(sp.query, keep_blank_values=True))
    qs.update({
        "command": "searchDetail",
        "sno": sno,
        "gosiGbn": gosi_gbn,
    })
    qs.setdefault("flag", qs.get("flag", "gosiGL"))
    qs.setdefault("svp", "Y")
    return urlunsplit((sp.scheme, sp.netloc, sp.path, urlencode(qs), ""))


def _extract_rows(html: str, source: SourceMeta, listing_url: str) -> list[Notice]:
    s = soup(html)
    notices: list[Notice] = []
    seen: set[str] = set()
    for tr in s.find_all("tr", onclick=re.compile(r"viewData\(")):
        m = re.search(r"viewData\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)", tr.get("onclick", ""))
        if not m:
            continue
        sno, gosi_gbn = m.group(1), m.group(2)
        detail_url = _detail_url(listing_url, sno, gosi_gbn)
        if detail_url in seen:
            continue
        seen.add(detail_url)
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue
        # Title is the longest non-date, non-number cell text.
        title = ""
        for td in tds:
            t = clean(td.get_text())
            if not t or t.isdigit() or parse_date(t):
                continue
            if len(t) > len(title):
                title = t
        if not title:
            continue
        posted_at = next(
            (parse_date(td.get_text()) for td in tds if parse_date(td.get_text())),
            None,
        )
        notices.append(Notice(
            region=source.region, sub_entity=source.sub_entity,
            source_page=source.source_page, source_url=source.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


SAP_PATH_HINT = "SAPGosiBizProcess.do"


def scrape_sap_citynet(source: SourceMeta) -> list[Notice]:
    """Loads the source URL in Playwright, finds the SAPGosiBizProcess frame
    (the page itself when direct, or an iframe when parent-embedded), and
    extracts rows. Retries 2x on empty result."""
    import time as _t
    for attempt in range(3):
        notices = _scrape_sap_citynet_once(source)
        if notices:
            return notices
        if attempt < 2:
            _t.sleep(2 * (attempt + 1))
    return []


def _scrape_sap_citynet_once(source: SourceMeta) -> list[Notice]:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        try:
            page.goto(source.source_url, wait_until="networkidle", timeout=30000)
            # Prefer the frame whose URL hits the SAP listing endpoint.
            sap_frame = next(
                (f for f in page.frames if SAP_PATH_HINT in f.url),
                page.main_frame,
            )
            try:
                sap_frame.wait_for_function(
                    "() => document.body && document.body.innerHTML.includes('viewData(')",
                    timeout=8000,
                )
            except Exception:
                pass
            html = sap_frame.content()
            return _extract_rows(html, source, sap_frame.url)
        finally:
            browser.close()


def make_sap_citynet_scrape(source: SourceMeta):
    def _scrape():
        return scrape_sap_citynet(source)
    return _scrape
