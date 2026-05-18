"""대구광역시 신기술 플랫폼 — singisul.daegu.go.kr/index.do.

Custom iCMS portal: each row's anchor uses
  onclick="fn_icms_navi_common('view', 'NTT_ID')".
The JS sets form.nttId then submits to
  /index.do?menu_link=/icms/bbs/selectBoardArticle.do&menu_id=00000880

Playwright is required because the listing table is rendered by JS.
We synthesize a GET-style detail URL with the same params so each notice
has a unique stable id.
"""
import re

from scrapers.base import Notice, SourceMeta, soup, clean, parse_date

_SRC = SourceMeta(
    region="기타", sub_entity="대구광역시 신기술 플랫폼", source_page="공법선정안내공고",
    source_url="https://singisul.daegu.go.kr/index.do?menu_id=00000880",
)

_DETAIL_TMPL = (
    "https://singisul.daegu.go.kr/index.do"
    "?menu_link=/icms/bbs/selectBoardArticle.do&menu_id=00000880&nttId="
)
_ID_RE = re.compile(r"fn_icms_navi_common\('view',\s*'(\d+)'\)")


def _scrape() -> list[Notice]:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        try:
            page.goto(_SRC.source_url, wait_until="networkidle", timeout=30000)
            html = page.content()
        finally:
            browser.close()
    s = soup(html)
    notices: list[Notice] = []
    seen: set[str] = set()
    for a in s.find_all("a", onclick=_ID_RE):
        m = _ID_RE.search(a.get("onclick", ""))
        if not m:
            continue
        nid = m.group(1)
        detail_url = _DETAIL_TMPL + nid
        if detail_url in seen:
            continue
        seen.add(detail_url)
        title = clean(a.get_text())
        if not title:
            continue
        tr = a.find_parent("tr")
        posted_at = None
        if tr:
            for td in tr.find_all("td"):
                d = parse_date(td.get_text())
                if d:
                    posted_at = d
                    break
        notices.append(Notice(
            region=_SRC.region, sub_entity=_SRC.sub_entity,
            source_page=_SRC.source_page, source_url=_SRC.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


SCRAPERS = [(_SRC, _scrape)]
