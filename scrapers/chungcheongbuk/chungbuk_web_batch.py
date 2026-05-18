"""
충청북도 — 청주시 cs.go.kr .web CMS (Playwright-rendered).

공지사항 uses ul.lst1 layout; 고시공고 uses div.list1table4 layout.
Both auto-detected by playwright_web.py.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.playwright_web import make_playwright_web


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="충청북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_playwright_web(src, **opts)


SCRAPERS = [
    _entry("청주시", "공지사항",
           "https://www.cs.go.kr/news/00002679/00002687.web"),
    _entry("청주시", "고시공고",
           "https://www.cs.go.kr/news/00002679/00006203.web"),
]
