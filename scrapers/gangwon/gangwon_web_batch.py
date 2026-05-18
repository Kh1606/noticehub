"""
강원도 — 삼척시 .web CMS (Playwright-rendered, lst1 layout).
"""
from scrapers.base import SourceMeta
from scrapers._helpers.playwright_web import make_playwright_web


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="강원도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_playwright_web(src, **opts)


SCRAPERS = [
    _entry("삼척시", "공지사항",
           "https://www.samcheok.go.kr/media/00083/00089.web"),
    _entry("삼척시", "고시공고",
           "https://www.samcheok.go.kr/media/00084/00095.web"),
]
