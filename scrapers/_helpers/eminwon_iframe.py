"""Generic scraper for Korean municipal sites whose 고시공고 boards are
embedded in an eminwon iframe (notice board served by a separate
`eminwon.<city>.go.kr` host loaded via JavaScript).

Strategy:
  1. Open the parent page in Playwright to discover the eminwon iframe URL
     (the host varies — `eminwon.<city>.go.kr` for most, same-domain
     `www.<city>.go.kr/emwp/...` for a few).
  2. Navigate the iframe directly to the parameterized listing JSP
     `/emwp/jsp/ofr/OfrNotAncmtLSub.jsp?not_ancmt_se_code=01,02,03,04,05`
     which forces eminwon to render data immediately. Without these
     params the bare `OfrAction.do` page sits empty waiting for a
     user-triggered search.
  3. Parse the rendered table: every row carries `onclick="searchDetail('ID')"`
     on multiple <a> elements. The title is heuristically the longest
     non-date, non-numeric text across the row's <a> elements.
  4. Build a stable canonical detail URL (POST endpoint via GET-style
     params) so each notice has a unique id.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit

from scrapers.base import Notice, SourceMeta, soup, clean, parse_date

LIST_PATH = "/emwp/jsp/ofr/OfrNotAncmtLSub.jsp?not_ancmt_se_code=01,02,03,04,05"
DETAIL_PATH = (
    "/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do"
    "?method=selectOfrNotAncmt&methodnm=selectOfrNotAncmtRegst&not_ancmt_mgt_no="
)
EMINWON_HOST_HINTS = ("eminwon", "/emwp/")
_DATE_RE = re.compile(r"^\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}")


def _pick_title(row, default_idx: int = 2) -> str | None:
    """Heuristic: the title is the longest <a> text in the row that isn't
    a pure number, date, or short string."""
    # Prefer an explicit subject cell if present (cheongju-style).
    sub = row.find("td", class_="subject")
    if sub:
        t = clean(sub.get_text())
        if t:
            return t
    candidates: list[str] = []
    for a in row.find_all("a"):
        t = clean(a.get_text())
        if not t or t.isdigit() or _DATE_RE.match(t):
            continue
        candidates.append(t)
    if candidates:
        return max(candidates, key=len)
    # Fallback to a fixed cell index.
    tds = row.find_all("td")
    if len(tds) > default_idx:
        return clean(tds[default_idx].get_text()) or None
    return None


def _pick_date(row) -> str | None:
    for td in row.find_all("td"):
        d = parse_date(td.get_text())
        if d:
            return d
    return None


_SEARCH_DETAIL_RE = re.compile(r"searchDetail\(\s*'(\d+)'\s*\)", re.IGNORECASE)


def _extract_rows(html: str, source: SourceMeta, eminwon_origin: str) -> list[Notice]:
    s = soup(html)
    detail_tmpl = eminwon_origin + DETAIL_PATH
    notices: list[Notice] = []
    seen: set[str] = set()
    for row in s.find_all("tr"):
        # Some sites put searchDetail in onclick (cheongju, asan);
        # others put it in href="javaScript:searchDetail('ID')" (goyang).
        a = None
        m = None
        for cand in row.find_all("a"):
            for attr in ("onclick", "href"):
                val = cand.get(attr, "") or ""
                mm = _SEARCH_DETAIL_RE.search(val)
                if mm:
                    a, m = cand, mm
                    break
            if a:
                break
        if not a or not m:
            continue
        notice_id = m.group(1)
        detail_url = detail_tmpl + notice_id
        if detail_url in seen:
            continue
        seen.add(detail_url)
        title = _pick_title(row)
        if not title:
            continue
        notices.append(Notice(
            region=source.region, sub_entity=source.sub_entity,
            source_page=source.source_page, source_url=source.source_url,
            detail_url=detail_url, title=title, posted_at=_pick_date(row),
        ))
    return notices


def scrape_eminwon_iframe(source: SourceMeta) -> list[Notice]:
    """Open parent, find eminwon iframe, navigate it to the parameterized
    list URL, parse the rendered rows."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        try:
            page.goto(source.source_url, wait_until="networkidle", timeout=30000)
            # Find any frame whose URL hits the eminwon system.
            frame = None
            try:
                page.wait_for_function(
                    """() => Array.from(document.querySelectorAll('iframe'))
                        .some(f => f.src && (f.src.includes('eminwon') || f.src.includes('/emwp/')))""",
                    timeout=15000,
                )
            except Exception:
                pass
            for f in page.frames:
                if any(h in f.url for h in EMINWON_HOST_HINTS):
                    frame = f
                    break
            if frame is None:
                return []
            origin = "{0}://{1}".format(*urlsplit(frame.url)[:2])

            # 1) Try the iframe as the parent loaded it — many sites
            # (e.g. cheongju) auto-submit data into OfrAction.do.
            try:
                frame.wait_for_function(
                    "() => document.body && document.body.innerHTML.includes(\"searchDetail('\")",
                    timeout=8000,
                )
            except Exception:
                pass
            html = frame.content()
            rows = _extract_rows(html, source, origin)
            if rows:
                return rows

            # 2) Fallback: navigate the iframe to the parameterized list JSP.
            try:
                frame.goto(origin + LIST_PATH, wait_until="domcontentloaded", timeout=20000)
                frame.wait_for_function(
                    "() => document.body && document.body.innerHTML.includes(\"searchDetail('\")",
                    timeout=15000,
                )
            except Exception:
                pass
            html = frame.content()
            return _extract_rows(html, source, origin)
        finally:
            browser.close()


def make_eminwon_iframe_scrape(source: SourceMeta):
    def _scrape():
        return scrape_eminwon_iframe(source)
    return _scrape
