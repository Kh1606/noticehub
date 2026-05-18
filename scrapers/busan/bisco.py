"""
부산시설공단 새소식 — bisco.or.kr/news/news01/

9-column listing: 번호 / 구분 / 제목 / 작성자 / 답변 / 처리 / 첨부파일 / 작성일자 / 조회수
Title is at column index 2 (not 1), date at index 7.
Detail link is a relative href that starts with `?`: ?bcIdx=125&MODE=V&bidx=...
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="부산광역시",
    sub_entity="부산시설공단",
    source_page="새소식",
    source_url="https://www.bisco.or.kr/news/news01/",
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
        if len(tds) < 8:
            continue
        a = tds[2].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(SOURCE.source_url, a.get("href", ""))
        posted_at = parse_date(tds[7].get_text())
        if not title or "MODE=V" not in detail_url:
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
