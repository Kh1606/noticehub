"""대구시청 고시공고 — daegu.go.kr/index.do?menu_id=00940170.

Row anchors use javascript:fn_goLinkView('NTT_ID','TYPE') which POSTs a
form to navigate to the detail page. We synthesize a stable per-notice
URL using the IDs as fragment params.
"""
import re

from scrapers.base import Notice, SourceMeta, soup, clean, parse_date

_SRC = SourceMeta(
    region="대구광역시", sub_entity="대구시청", source_page="고시 공고",
    source_url="https://www.daegu.go.kr/index.do?menu_id=00000855",
)
# Real working URL (v2's 00000855 redirects to /code404.jsp due to anti-bot).
_FETCH_URL = "https://www.daegu.go.kr/index.do?menu_id=00940170"
_GOLINK_RE = re.compile(r"fn_goLinkView\('(\d+)',\s*'(\w+)'\)")


def _scrape() -> list[Notice]:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            ignore_https_errors=True, locale="ko-KR",
            extra_http_headers={"Referer": "https://www.daegu.go.kr/"},
        )
        page = ctx.new_page()
        try:
            page.goto(_FETCH_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)
            html = page.content()
        finally:
            browser.close()
    s = soup(html)
    notices: list[Notice] = []
    seen: set[str] = set()
    tables = [t for t in s.find_all("table") if len(t.find_all("tr")) > 3]
    if not tables:
        return []
    table = max(tables, key=lambda t: len(t.find_all("tr")))
    for tr in table.find_all("tr"):
        a = tr.find("a", href=_GOLINK_RE)
        if not a:
            continue
        m = _GOLINK_RE.search(a.get("href", ""))
        if not m:
            continue
        nid, gbn = m.group(1), m.group(2)
        # Synthetic detail URL keyed on (nid, gbn)
        detail_url = f"{_FETCH_URL}&v2_id={nid}&v2_gbn={gbn}"
        if detail_url in seen:
            continue
        seen.add(detail_url)
        title = clean(a.get_text())
        if not title:
            continue
        tds = tr.find_all("td")
        posted_at = next(
            (parse_date(td.get_text()) for td in tds if parse_date(td.get_text())),
            None,
        )
        notices.append(Notice(
            region=_SRC.region, sub_entity=_SRC.sub_entity,
            source_page=_SRC.source_page, source_url=_SRC.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


SCRAPERS = [(_SRC, _scrape)]
