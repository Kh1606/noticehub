"""
서울시 도로사업소 공지사항 — cis.seoul.go.kr/TotalAlimi_new/Notice.action

Listing columns: 번호 / 제목 / 정보보기 / 등록부서 / 조회수 / 등록일
Note: date is the LAST column (index 5), not index 3.
Detail link relative: /TotalAlimi_new/NoticeDtl.action?seq=10086
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="서울특별시",
    sub_entity="서울시 도로사업소",
    source_page="공지사항",
    source_url="https://cis.seoul.go.kr/TotalAlimi_new/Notice.action",
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
        if len(tds) < 6:
            continue
        a = tds[1].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(SOURCE.source_url, a.get("href", ""))
        posted_at = parse_date(tds[5].get_text())  # 등록일 is last column
        if not title or "NoticeDtl" not in detail_url:
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
