"""
전국 공사/공단 — Playwright-based scrapers for boardlist.do CMS.

경북개발공사 (gbdc.co.kr) and 경남개발공사 (gndc.co.kr) both use an
Axios-loaded boardlist.do CMS where the notice list is populated after JS
execution.  Column layout: 번호 | 제목 | 첨부 | 부서 | 작성일 | 조회.
Detail URL: /boardview.do?seqId={seqId}&BBS_ID={bbsid}&IPDS_IDX={uuid}
"""
from __future__ import annotations
import re

from scrapers.base import SourceMeta, Notice, parse_date, clean


def _scrape_boardlist(
    source: SourceMeta,
    *,
    detail_base: str,
    onclick_re: str,
    extra_params: str = "",
) -> list[Notice]:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(source.source_url, wait_until="networkidle", timeout=30000)

        data = page.evaluate("""() => {
            const table = [...document.querySelectorAll("table")]
                .sort((a, b) => b.rows.length - a.rows.length)[0];
            const rows = table
                ? [...table.rows].slice(1).map(row => {
                    const tds = [...row.cells];
                    const a = row.querySelector("a[onclick]");
                    return {
                        title: tds[1] ? tds[1].innerText.trim() : "",
                        date:  tds[4] ? tds[4].innerText.trim() : "",
                        onclick: a ? a.getAttribute("onclick") : ""
                    };
                  })
                : [];
            return {
                seqId:   typeof seqId   !== "undefined" ? seqId   : "",
                bbsid:   typeof bbsid   !== "undefined" ? bbsid   : "",
                bbsType: typeof bbsType !== "undefined" ? bbsType : "",
                rows: rows
            };
        }""")
        browser.close()

    seq_id   = data.get("seqId", "")
    bbs_id   = data.get("bbsid", "")
    bbs_type = data.get("bbsType", "")
    pat = re.compile(onclick_re)

    notices: list[Notice] = []
    for row in data.get("rows", []):
        title = clean(row.get("title", ""))
        if not title:
            continue
        m = pat.search(row.get("onclick", ""))
        if not m:
            continue
        uuid = m.group(1)
        detail_url = f"{detail_base}?seqId={seq_id}&BBS_ID={bbs_id}&IPDS_IDX={uuid}"
        if extra_params:
            detail_url += extra_params.format(bbs_type=bbs_type)
        notices.append(Notice(
            region=source.region, sub_entity=source.sub_entity,
            source_page=source.source_page, source_url=source.source_url,
            detail_url=detail_url, title=title,
            posted_at=parse_date(row.get("date", "")),
        ))
    return notices


def _boardlist(sub, page_name, url, detail_base, onclick_re, extra_params=""):
    src = SourceMeta(region="공사", sub_entity=sub, source_page=page_name, source_url=url)
    return src, lambda s=src, db=detail_base, op=onclick_re, ex=extra_params: (
        _scrape_boardlist(s, detail_base=db, onclick_re=op, extra_params=ex)
    )


SCRAPERS = [
    # 경북개발공사 — boardlist.do Axios CMS; seqId/bbsid from JS context
    _boardlist(
        "경북개발공사", "공지사항",
        "https://www.gbdc.co.kr/boardlist.do?seqId=0000003726",
        detail_base="https://www.gbdc.co.kr/boardview/boardview.do",
        onclick_re=r"""selectBbsItem\(["']([0-9a-fA-F-]+)['"]\)""",
        extra_params="&BBS_TYPE={bbs_type}&COLM1=&COLM1_CD=",
    ),
    # 경남개발공사 — same CMS; seqId/bbsid in static HTML; shorter detail URL
    _boardlist(
        "경남개발공사", "공지사항",
        "https://www.gndc.co.kr/boardlist.do?seqId=0000000047",
        detail_base="https://www.gndc.co.kr/boardview.do",
        onclick_re=r"""selectitem\(["']([0-9a-fA-F-]+)['"]\)""",
    ),
]
