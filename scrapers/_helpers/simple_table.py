"""
Generic table-listing scraper.

Most Korean gov board pages share the shape:

  <table>
    <thead><tr><th>번호</th><th>제목</th>...<th>등록일</th>...</tr></thead>
    <tbody>
      <tr>
        <td>...</td>
        <td><a href="…detail…">제목</a></td>
        ...
        <td>2026-05-04</td>
        ...
      </tr>
    </tbody>
  </table>

Differences across sites:
- title column index (usually 1, sometimes 2 when there's an extra category col)
- date column index (auto-detected by scanning all cells for a parseable date)
- detail-link form (relative href is overwhelmingly common)
- which <table> to pick when multiple exist (default: largest)

This helper absorbs all that with a small per-site config.
"""
from __future__ import annotations
from typing import Callable
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean


def extract_from_html(
    html: str | bytes,
    source: SourceMeta,
    *,
    title_col: int = 1,
    link_col: int | None = None,
    require: str | None = None,
    listing_picker: Callable | None = None,
) -> list[Notice]:
    """Extract notices from already-fetched HTML (no network call).

    Useful for Playwright-rendered pages: fetch with Playwright, pass
    page.content() here instead of letting get() fetch it again.

    If ``link_col`` is set, the detail URL is taken from that column's <a href>
    while the title text still comes from ``title_col``.  Useful for boards
    that put the clickable title in one column and the direct URL in another
    (e.g. eGovFrame BBSMSTR boards with split title/attachment columns).
    """
    s = soup(html)
    tables = s.find_all("table")
    if not tables:
        return []
    table = (listing_picker(tables) if listing_picker
             else max(tables, key=lambda t: len(t.find_all("tr"))))

    url_col = link_col if link_col is not None else title_col
    notices: list[Notice] = []
    body = table.find("tbody") or table
    for tr in body.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) <= max(title_col, url_col):
            continue
        a = tds[url_col].find("a", href=True)
        if not a:
            continue
        href = (a.get("href") or "").strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue
        if require and require not in href:
            continue
        title = clean(tds[title_col].get_text())
        if not title:
            continue
        detail_url = urljoin(source.source_url, href)
        posted_at = next(
            (parse_date(td.get_text()) for td in tds if parse_date(td.get_text())),
            None,
        )
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


def scrape_simple_table(
    source: SourceMeta,
    *,
    title_col: int = 1,
    link_col: int | None = None,
    require: str | None = None,
    listing_picker: Callable | None = None,
) -> list[Notice]:
    """Fetch source_url then extract notices from the HTML table."""
    r = get(source.source_url)
    return extract_from_html(
        r.content, source,
        title_col=title_col, link_col=link_col,
        require=require, listing_picker=listing_picker,
    )


def make_scrape(source: SourceMeta, **opts):
    """Returns a thunk `() -> list[Notice]` for batch SCRAPERS exports."""
    def _scrape():
        return scrape_simple_table(source, **opts)
    return _scrape


def make_ssl_scrape(source: SourceMeta, **opts):
    """Like make_scrape but fetches with ssl_get (for sites with old TLS stacks)."""
    from scrapers.base import ssl_get
    def _scrape():
        r = ssl_get(source.source_url)
        return extract_from_html(r.text, source, **opts)
    return _scrape
