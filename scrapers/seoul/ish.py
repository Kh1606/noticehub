"""
서울주택도시공사 (i-SH) 공지사항 — i-sh.co.kr

JS handler `getDetailView(seq)` swaps the form action from list.do → view.do.
We synthesize the equivalent GET URL: same path with /view.do?seq=<id>...
Listing columns: 번호 / 제목 / 담당부서 / 등록일 / 조회수
Date is at column index 3.
"""
from __future__ import annotations
import re

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="서울특별시",
    sub_entity="서울주택도시공사",
    source_page="공지사항",
    source_url=(
        "https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_241/list.do"
        "?multi_itm_seqs=1,2,4,8,16,32,64,128,256,512"
    ),
)
DETAIL_BASE = "https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_241/view.do"
_SEQ_RE = re.compile(r"getDetailView\([\'\"]?(\d+)[\'\"]?\)")


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
    s = soup(r.content)

    # Page has 3 tables (search, listing, pager). Pick the one with the most rows.
    tables = s.find_all("table")
    listing = max(tables, key=lambda t: len(t.find_all("tr")), default=None)
    if listing is None:
        return []

    notices: list[Notice] = []
    body = listing.find("tbody") or listing
    for tr in body.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue
        a = tds[1].find("a")
        if not a:
            continue
        m = _SEQ_RE.search(a.get("onclick") or a.get("href") or "")
        if not m:
            continue
        seq = m.group(1)
        title = clean(a.get_text())
        # Synthesize GET-style detail URL — site accepts it
        detail_url = (
            f"{DETAIL_BASE}?seq={seq}"
            "&multi_itm_seqs=1,2,4,8,16,32,64,128,256,512"
        )
        posted_at = parse_date(tds[3].get_text())
        if not title:
            continue
        notices.append(
            Notice(
                region=SOURCE.region,
                sub_entity=SOURCE.sub_entity,
                source_page=SOURCE.source_page,
                source_url=SOURCE.source_url,
                detail_url=detail_url,
                title=title,
                posted_at=posted_at,
            )
        )
    return notices


if __name__ == "__main__":
    for n in scrape():
        print(f"{n.posted_at}  {n.title}")
        print(f"    → {n.detail_url}")
