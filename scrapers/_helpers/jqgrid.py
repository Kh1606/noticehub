"""Helper for jqGrid widgets (rows don't have detail anchors; the JS
opens a detail dialog on double-click, with the row's data-bound key
controlling what gets loaded).

For our purposes (UI just needs a unique notice_id per row), we extract
the visible cells plus the row's unique-key cell and build a synthetic
detail URL `{source_url}#row-{uid}`. The user clicking on that URL lands
on the listing page (the closest thing we can offer without a stable
per-notice URL on jqGrid sites).
"""
from __future__ import annotations
from typing import Callable

from scrapers.base import Notice, SourceMeta, soup, clean, parse_date


def scrape_jqgrid(source: SourceMeta, **opts) -> list[Notice]:
    """Render + extract. Retries 2x on empty result to absorb CI flake."""
    import time as _t
    for attempt in range(3):
        notices = _scrape_jqgrid_once(source, **opts)
        if notices:
            return notices
        if attempt < 2:
            _t.sleep(2 * (attempt + 1))
    return []


def _scrape_jqgrid_once(
    source: SourceMeta,
    *,
    title_col: int,
    date_col: int,
    uid_col: int,
) -> list[Notice]:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        try:
            page.goto(source.source_url, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)
            rows = page.evaluate("""(() => {
                const trs = document.querySelectorAll('tr.jqgrow');
                return Array.from(trs).map(tr => Array.from(tr.querySelectorAll('td'))
                    .map(td => (td.getAttribute('title') || td.innerText || '').trim()));
            })()""")
        finally:
            browser.close()

    notices: list[Notice] = []
    seen: set[str] = set()
    for cells in rows:
        if len(cells) <= max(title_col, date_col, uid_col):
            continue
        uid = cells[uid_col].strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        title = clean(cells[title_col])
        if not title:
            continue
        # Synthetic detail URL — unique per row, lands on listing page.
        sep = "&" if "?" in source.source_url else "?"
        detail_url = f"{source.source_url}{sep}v2_row={uid}"
        notices.append(Notice(
            region=source.region, sub_entity=source.sub_entity,
            source_page=source.source_page, source_url=source.source_url,
            detail_url=detail_url, title=title,
            posted_at=parse_date(cells[date_col]),
        ))
    return notices


def make_jqgrid_scrape(source: SourceMeta, **opts) -> Callable:
    def _scrape():
        return scrape_jqgrid(source, **opts)
    return _scrape
