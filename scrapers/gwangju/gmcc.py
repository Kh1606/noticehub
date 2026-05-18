"""
광주도시공사 공고 — gmcc.co.kr/board.es?mid=...&bid=0018

Listing columns: 번호 / 분류 / 제목 / 첨부파일 / 등록일 / 조회수
Title is at column index 2 (after 번호 + 분류). Date at index 4.
Detail link is a clean relative href on the title <a>:
  /board.es?mid=a10402000000&bid=0018&act=view&list_no=17822&nPage=1
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="광주광역시",
    sub_entity="광주도시공사",
    source_page="공고",
    source_url="https://www.gmcc.co.kr/board.es?mid=a10402000000&bid=0018",
)


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
    s = soup(r.content)
    table = s.find("table")
    if not table:
        return []

    notices: list[Notice] = []
    body = table.find("tbody") or table
    for tr in body.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 5:
            continue
        a = tds[2].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(SOURCE.source_url, a.get("href", ""))
        posted_at = parse_date(tds[4].get_text())
        if not title or "act=view" not in detail_url:
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
