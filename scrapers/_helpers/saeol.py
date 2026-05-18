"""
saeol portal helper — Korean government open notice boards (portal/saeol/gosi/list.do
and related paths).  Plain HTTP works; the article link JS embeds notAncmtMgtNo.

Three onclick patterns (all embed notAncmtMgtNo):
  1. <a data-action="…/view.do?notAncmtMgtNo=ID">          (most sites)
  2. <a href="#" onclick="fn_search_detail('ID')">          (gongju, hongseong)
  3. <a href="#" onclick="boardView('page','ID')">          (anseong, ui4u)
  4. <button class="button_view" data-list-no="ID">         (yesan)
"""
from __future__ import annotations

import re
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, clean, get, parse_date
from scrapers.base import soup as mk_soup


def _view_tmpl(page_text: str) -> str | None:
    """Extract view URL template (up to and including 'notAncmtMgtNo=') from page JS."""
    # .action = '/path/view.do?notAncmtMgtNo='  (concatenation form)
    m = re.search(r"""action\s*=\s*['"]([^'"]+notAncmtMgtNo=)['"]""", page_text)
    if m:
        return m.group(1)
    # fn_submit("/path/view.do")  (yesan button_view form)
    m = re.search(r"""fn_submit\s*\(\s*['"]([^'"]+view\.do)['"]""", page_text)
    if m:
        return m.group(1) + "?notAncmtMgtNo="
    return None


def scrape_saeol(source: SourceMeta) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    tmpl = _view_tmpl(r.text)
    notices: list[Notice] = []

    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if not tds:
            continue

        detail_url: str | None = None
        title: str | None = None

        # Pattern 1: <a data-action="…notAncmtMgtNo=ID">
        link_a = row.find("a", attrs={"data-action": True})
        if link_a and "notAncmtMgtNo" in link_a.get("data-action", ""):
            detail_url = urljoin(source.source_url, link_a["data-action"])
            title = clean(link_a.get_text())

        # Patterns 2 & 3: <a href="#" onclick="…('ID')">
        if not detail_url:
            link_a = row.find("a", href="#")
            if link_a and tmpl:
                onclick = link_a.get("onclick", "")
                ids = re.findall(r"'(\d+)'", onclick)
                if ids:
                    detail_url = urljoin(source.source_url, tmpl + ids[-1])
                    for span in link_a.find_all("span"):
                        span.decompose()
                    title = clean(link_a.get_text())

        # Pattern 4: <button class="button_view" data-list-no="ID">
        if not detail_url:
            btn = row.find("button", class_="button_view")
            if btn and btn.get("data-list-no") and tmpl:
                # remove decoration spans (새글 badges etc.)
                for span in btn.find_all("span"):
                    span.decompose()
                detail_url = urljoin(source.source_url, tmpl + btn["data-list-no"])
                title = clean(btn.get_text())

        if not detail_url or not title:
            continue

        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_saeol_scrape(source: SourceMeta) -> callable:
    return lambda: scrape_saeol(source)


# ── portal/bbs/list.do ────────────────────────────────────────────────────────
# Link patterns:
#   data-action="/portal/bbs/view.do?bIdx=ID&ptIdx=P"          (yc.go.kr)
#   onclick="goTo.view('list','BIDX','PTIDX','MID')"           (gc, chilgok)
#   onclick="boardView('portal','list','SEQ','Y','BIDX','PTIDX','MID','PAGE')"  (gbmg)


def scrape_portal_bbs(source: SourceMeta) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if not tds:
            continue

        detail_url: str | None = None
        title: str | None = None

        link_a = row.find("a", href="#") or row.find("a", attrs={"data-action": True})
        if not link_a:
            continue

        # data-action (yc.go.kr has this alongside onclick)
        da = link_a.get("data-action", "")
        if da and "bIdx" in da:
            detail_url = urljoin(source.source_url, da)
            title = clean(link_a.get_text())
        else:
            onclick = link_a.get("onclick", "")
            args = re.findall(r"'([^']*)'", onclick)
            if not args:
                continue
            func = onclick.split("(")[0].strip()
            if func == "goTo.view" and len(args) >= 3:
                # goTo.view('list', BIDX, PTIDX, MID)
                bidx, ptidx, mid = args[1], args[2], args[3] if len(args) > 3 else ""
                path = f"/portal/bbs/view.do?bIdx={bidx}&ptIdx={ptidx}"
                if mid:
                    path += f"&mId={mid}"
                detail_url = urljoin(source.source_url, path)
            elif func == "boardView" and len(args) >= 6:
                # boardView('portal','list','SEQ','Y','BIDX','PTIDX','MID','PAGE')
                bidx, ptidx = args[4], args[5]
                mid = args[6] if len(args) > 6 else ""
                path = f"/portal/bbs/view.do?bIdx={bidx}&ptIdx={ptidx}"
                if mid:
                    path += f"&mId={mid}"
                detail_url = urljoin(source.source_url, path)

            if detail_url:
                for span in link_a.find_all("span"):
                    span.decompose()
                title = clean(link_a.get_text())

        if not detail_url or not title:
            continue

        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_portal_bbs_scrape(source: SourceMeta) -> callable:
    return lambda: scrape_portal_bbs(source)


# ── portal/board/post/list.do ─────────────────────────────────────────────────
# Link: <a data-req-get-p-idx="PIDX"> inside a row
# View URL: form#viewForm action + &pIdx=PIDX


def scrape_portal_board(source: SourceMeta) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    form = bs.find("form", id="viewForm")
    if not form:
        return []
    view_action = form.get("action", "")
    if not view_action:
        return []

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        link_a = row.find("a", attrs={"data-req-get-p-idx": True})
        if not link_a:
            continue

        pidx = link_a["data-req-get-p-idx"]
        detail_url = urljoin(source.source_url, view_action + f"&pIdx={pidx}")
        title = clean(link_a.get_text())

        if not title:
            continue

        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_portal_board_scrape(source: SourceMeta) -> callable:
    return lambda: scrape_portal_board(source)


# ── fn_articleLink (goryeong-style CMS) ──────────────────────────────────────
# JS: fn_articleLink(BOARD_IDX)
# View URL template embedded in page: boardView.do?IDX=X&BRD_ID=Y&BOARD_IDX=


def scrape_fn_article_link(source: SourceMeta) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    m = re.search(r"boardView\.do\?[^\"'<>\s]+BOARD_IDX=", r.text)
    if not m:
        return []
    view_tmpl = m.group()

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if not tds:
            continue
        a = row.find("a", onclick=True)
        if not a:
            continue
        m2 = re.search(r"fn_articleLink\((\d+)\)", a.get("onclick", ""))
        if not m2:
            continue
        detail_url = urljoin(source.source_url, view_tmpl + m2.group(1))
        title = clean(a.get_text())
        if not title:
            continue
        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_fn_article_link_scrape(source: SourceMeta) -> callable:
    return lambda: scrape_fn_article_link(source)


# ── goPage2 / articleSeq CMS (jeongseon-style) ───────────────────────────────
# JS: href="javascript:goPage2('SEQ')"
# Detail URL: {list_url}?articleSeq={seq}  (GET-accessible)


def scrape_go_page2(source: SourceMeta) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if not tds:
            continue
        a = row.find("a", href=re.compile(r"goPage2\("))
        if not a:
            continue
        m = re.search(r"goPage2\('(\d+)'\)", a.get("href", ""))
        if not m:
            continue
        seq = m.group(1)
        detail_url = source.source_url.split("?")[0] + f"?articleSeq={seq}"
        for span in a.find_all("span"):
            span.decompose()
        title = clean(a.get_text())
        if not title:
            continue
        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_go_page2_scrape(source: SourceMeta) -> callable:
    return lambda: scrape_go_page2(source)


# ── goView3 CMS (lh.or.kr-style) ─────────────────────────────────────────────
# JS: onclick="goView3('LIST_NO', '/path?act=view&list_no=LIST_NO&...')"
# href="#none"  — detail URL is 2nd argument of goView3


def scrape_go_view3(source: SourceMeta, *, title_col: int = 1) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if len(tds) <= title_col:
            continue
        a = tds[title_col].find("a", onclick=True)
        if not a:
            continue
        onclick = a.get("onclick", "")
        m = re.search(r"goView3\('[^']+',\s*'([^']+)'", onclick)
        if not m:
            continue
        detail_url = urljoin(source.source_url, m.group(1))
        title = clean(a.get_text())
        if not title:
            continue
        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_go_view3_scrape(source: SourceMeta, **opts) -> callable:
    return lambda: scrape_go_view3(source, **opts)


# ── BBSMSTR fn_search_detail (eGovFrame community board) ─────────────────────
# Used by: gongju, hongseong, yesan (충청남도 BBSMSTR boards)
# onclick patterns: <a onclick="fn_search_detail('ID')"> or <button class="link" ...>
# View URL: {list_url_dir}/view.do?nttId={id}


def scrape_bbsmstr_fn_detail(source: SourceMeta) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    view_base = source.source_url.rsplit("/", 1)[0] + "/view.do?nttId="

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if not tds:
            continue
        nttid: str | None = None
        title: str | None = None
        for elem in row.find_all(["a", "button"]):
            onclick = elem.get("onclick", "")
            m = re.search(r"fn_search_detail\('([^']+)'\)", onclick)
            if m:
                nttid = m.group(1)
                for span in elem.find_all("span"):
                    span.decompose()
                title = clean(elem.get_text())
                break
        if not nttid or not title:
            continue
        detail_url = view_base + nttid
        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_bbsmstr_fn_detail_scrape(source: SourceMeta) -> callable:
    return lambda: scrape_bbsmstr_fn_detail(source)


# ── fnGoDetail (ansan-style selectPageListBbs boards) ────────────────────────
# onclick="fnGoDetail(bbs_seq)" with hidden input bbs_code
# Detail URL: /www/common/bbs/selectBbsDetail.do?bbs_seq={id}&bbs_code={bbs_code}


def scrape_fn_go_detail(source: SourceMeta, *, title_col: int = 2) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    inp = bs.find("input", attrs={"name": "bbs_code"})
    bbs_code = inp["value"] if inp else None

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table or not bbs_code:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if len(tds) <= title_col:
            continue
        a = tds[title_col].find("a", onclick=True)
        if not a:
            continue
        m = re.search(r"fnGoDetail\(\s*(\d+)\s*\)", a.get("onclick", ""))
        if not m:
            continue
        bbs_seq = m.group(1)
        detail_url = urljoin(
            source.source_url,
            f"/www/common/bbs/selectBbsDetail.do?bbs_seq={bbs_seq}&bbs_code={bbs_code}",
        )
        title = clean(tds[title_col].get_text())
        if not title:
            continue
        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_fn_go_detail_scrape(source: SourceMeta, **opts) -> callable:
    return lambda: scrape_fn_go_detail(source, **opts)


# ── BD_board jsView (paju-style OpenWorks boards) ────────────────────────────
# onclick="jsView('bbsCd', 'seq', regPwd, openYn)"
# Detail URL: /user/board/BD_board.view.do?bbsCd={bbs_cd}&seq={seq}


def scrape_bd_board(source: SourceMeta, *, title_col: int = 1) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if len(tds) <= title_col:
            continue
        a = tds[title_col].find("a", onclick=True)
        if not a:
            continue
        m = re.search(r"jsView\('(\d+)',\s*'([^']+)'", a.get("onclick", ""))
        if not m:
            continue
        bbs_cd, seq = m.group(1), m.group(2)
        detail_url = urljoin(
            source.source_url,
            f"/user/board/BD_board.view.do?bbsCd={bbs_cd}&seq={seq}",
        )
        for span in a.find_all("span"):
            span.decompose()
        title = clean(a.get_text())
        if not title:
            continue
        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_bd_board_scrape(source: SourceMeta, **opts) -> callable:
    return lambda: scrape_bd_board(source, **opts)


# ── popupCenter eminwon (brcn-style) ─────────────────────────────────────────
# Row anchor: <a href="#popup" onclick="popupCenter('DETAIL_URL', 'popwin')">
# Detail URL embedded in onclick; full URL, not relative.


def scrape_popup_center(source: SourceMeta, *, title_col: int = 1) -> list[Notice]:
    r = get(source.source_url)
    bs = mk_soup(r.text)

    table = max(
        bs.find_all("table"),
        key=lambda t: len(t.find_all("tr")),
        default=None,
    )
    if not table:
        return []

    notices: list[Notice] = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if len(tds) <= title_col:
            continue
        a = tds[title_col].find("a", onclick=True)
        if not a:
            continue
        m = re.search(r"popupCenter\('([^']+)'", a.get("onclick", ""))
        if not m:
            continue
        detail_url = m.group(1)
        title = clean(a.get_text())
        if not title:
            continue
        posted_at = None
        for td in reversed(tds):
            d = parse_date(td.get_text(strip=True))
            if d:
                posted_at = d
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


def make_popup_center_scrape(source: SourceMeta, **opts) -> callable:
    return lambda: scrape_popup_center(source, **opts)
