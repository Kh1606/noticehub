"""
Playwright-based scraper for .web CMS sites used by Korean local governments.

Three board layouts share the same CMS but render differently:

  lst1      ul.lst1 > li.li1 > a.a1[amode=view]   (most sites)
            title: strong.t1, date: span.t3

  list1t4   div.list1table4 > li > span.t2 > a[amode=view]
            title: a text, date: span.t5 in same li

  table     <table> with amode=view links in a title column
            (창원시 variant — uses extract_from_html from simple_table)

Detection order: lst1 → list1table4 → table fallback.
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, soup, parse_date, clean
from scrapers._helpers.simple_table import extract_from_html


def _playwright_fetch(url: str) -> str:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=30000)
        html = page.content()
        browser.close()
    return html


def _extract_lst1(source: SourceMeta, container) -> list[Notice]:
    notices: list[Notice] = []
    seen: set[str] = set()
    for a in container.find_all("a", class_="a1"):
        href = (a.get("href") or "").strip()
        if not href or "amode=view" not in href:
            continue
        detail_url = urljoin(source.source_url, href)
        if detail_url in seen:
            continue
        seen.add(detail_url)
        title_el = a.find("strong", class_="t1")
        if not title_el:
            continue
        for tag in title_el.find_all(["i", "img"]):
            tag.decompose()
        title = clean(title_el.get_text())
        if not title:
            continue
        date_el = a.find("span", class_="t3")
        posted_at = parse_date(date_el.get_text() if date_el else None)
        notices.append(Notice(
            region=source.region, sub_entity=source.sub_entity,
            source_page=source.source_page, source_url=source.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


def _extract_list1table4(source: SourceMeta, container) -> list[Notice]:
    notices: list[Notice] = []
    seen: set[str] = set()
    for li in container.find_all("li"):
        a = li.find("a", href=True)
        if not a:
            continue
        href = (a.get("href") or "").strip()
        if not href or "amode=view" not in href:
            continue
        detail_url = urljoin(source.source_url, href)
        if detail_url in seen:
            continue
        seen.add(detail_url)
        for tag in a.find_all(["i", "img"]):
            tag.decompose()
        title = clean(a.get_text())
        if not title:
            continue
        date_el = li.find("span", class_="t5")
        posted_at = parse_date(date_el.get_text() if date_el else None)
        notices.append(Notice(
            region=source.region, sub_entity=source.sub_entity,
            source_page=source.source_page, source_url=source.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


def scrape_playwright_web(
    source: SourceMeta,
    *,
    title_col: int = 1,
) -> list[Notice]:
    html = _playwright_fetch(source.source_url)
    bs = soup(html)

    lst1 = bs.find("ul", class_="lst1")
    if lst1:
        return _extract_lst1(source, lst1)

    lt4 = bs.find("div", class_="list1table4")
    if lt4:
        return _extract_list1table4(source, lt4)

    return extract_from_html(html, source, title_col=title_col, require="amode=view")


def make_playwright_web(source: SourceMeta, **opts):
    """Returns a thunk `() -> list[Notice]` for batch SCRAPERS exports."""
    def _scrape():
        return scrape_playwright_web(source, **opts)
    return _scrape
