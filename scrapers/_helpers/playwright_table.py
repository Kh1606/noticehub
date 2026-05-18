"""Tiny helper: render a page with Playwright, then hand the rendered HTML
to simple_table.extract_from_html.

Use for sites whose listing table is in the DOM after JS runs but not in
the raw server HTML (so plain requests.get() returns no rows). Different
from playwright_web.py which targets the .web CMS ul/li layout — this
one is for sites that produce a standard <table> after render.
"""
from __future__ import annotations
from typing import Callable

from scrapers.base import Notice, SourceMeta
from scrapers._helpers.simple_table import extract_from_html


def scrape_playwright_table(source: SourceMeta, **opts) -> list[Notice]:
    """Render with Playwright + extract via simple_table.extract_from_html.
    Retries 2x on empty result to absorb CI flake."""
    import time as _t
    for attempt in range(3):
        notices = _scrape_playwright_table_once(source, **opts)
        if notices:
            return notices
        if attempt < 2:
            _t.sleep(2 * (attempt + 1))
    return []


def _scrape_playwright_table_once(
    source: SourceMeta,
    *,
    title_col: int = 1,
    link_col: int | None = None,
    require: str | None = None,
    listing_picker: Callable | None = None,
    wait_until: str = "networkidle",
) -> list[Notice]:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        try:
            page.goto(source.source_url, wait_until=wait_until, timeout=30000)
            html = page.content()
        finally:
            browser.close()
    return extract_from_html(
        html, source,
        title_col=title_col, link_col=link_col,
        require=require, listing_picker=listing_picker,
    )


def make_playwright_table_scrape(source: SourceMeta, **opts):
    def _scrape():
        return scrape_playwright_table(source, **opts)
    return _scrape
