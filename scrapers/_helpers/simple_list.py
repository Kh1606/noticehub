"""
Generic scraper for pages that have notice links but no <table>.

Some Korean government CMSes (list.jinan, list.jangsu, list.gochang, boardList.do,
index.9is portal pages, etc.) render their board listings as <ul>/<li>/<div>
layouts.  simple_table.py can't handle them because it bails out when
find_all("table") returns nothing.

This helper scans all <a href> elements on the page, filters by `require`, and
walks up to the nearest block-level ancestor to pick up the date.
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, ssl_get, soup, parse_date, clean


def scrape_simple_list(
    source: SourceMeta,
    *,
    require: str | None = None,
    use_ssl: bool = False,
) -> list[Notice]:
    r = (ssl_get if use_ssl else get)(source.source_url)
    bs = soup(r.text)  # r.text (not r.content) — some sites need encoding-decoded str

    seen: set[str] = set()
    notices: list[Notice] = []

    for a in bs.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href or href.startswith(("#", "javascript:")):
            continue
        if require and require not in href:
            continue
        title = clean(a.get_text())
        if not title:
            continue
        detail_url = urljoin(source.source_url, href)
        if detail_url in seen:
            continue
        seen.add(detail_url)

        # Walk up to nearest block ancestor to find a date (max 6 levels).
        posted_at: str | None = None
        for depth, parent in enumerate(a.parents):
            if depth > 6:
                break
            if parent.name in ("li", "tr", "div", "article", "section"):
                candidate = parse_date(parent.get_text())
                if candidate:
                    posted_at = candidate
                break

        notices.append(
            Notice(
                region=source.region,
                sub_entity=source.sub_entity,
                source_page=source.source_page,
                source_url=source.source_url,
                detail_url=detail_url,
                title=title,
                posted_at=posted_at,
            )
        )
    return notices


def make_list_scrape(source: SourceMeta, **opts):
    """Returns a thunk `() -> list[Notice]` for batch SCRAPERS exports."""
    def _scrape():
        return scrape_simple_list(source, **opts)
    return _scrape


def make_ssl_list_scrape(source: SourceMeta, **opts):
    """Like make_list_scrape but uses ssl_get for old-TLS servers."""
    def _scrape():
        return scrape_simple_list(source, use_ssl=True, **opts)
    return _scrape
