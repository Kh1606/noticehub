"""고양시청 고시 공고 — eminwon iframe at eminwon.goyang.go.kr.

The parent page (goyang.go.kr/www/link/BD_notice.do) embeds the eminwon
iframe but the generic eminwon_iframe helper times out trying to read it.
Going directly to the eminwon JSP URL works reliably.
"""
import re
from urllib.parse import urlsplit

from scrapers.base import Notice, SourceMeta, soup, clean, parse_date
from scrapers._helpers.eminwon_iframe import _extract_rows, DETAIL_PATH

_SRC = SourceMeta(
    region="경기도", sub_entity="고양시청", source_page="고시 공고",
    source_url="http://www.goyang.go.kr/www/link/BD_notice.do",
)
_LIST_URL = (
    "https://eminwon.goyang.go.kr/emwp/jsp/ofr/OfrNotAncmtLSub.jsp"
    "?not_ancmt_se_code=01,02,03,04,05"
)


def _scrape() -> list[Notice]:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        try:
            page.goto(_LIST_URL, wait_until="networkidle", timeout=30000)
            html = page.content()
        finally:
            browser.close()
    origin = "https://eminwon.goyang.go.kr"
    return _extract_rows(html, _SRC, origin)


SCRAPERS = [(_SRC, _scrape)]
