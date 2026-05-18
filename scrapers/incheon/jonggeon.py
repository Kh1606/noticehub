"""
인천시청 종합건설본부 알림마당 — incheon.go.kr/jonggeon/JO020101

Listing columns: 번호 / 제목 / 담당부서 / 작성일 / 조회수
Detail link is a clean relative href: /jonggeon/JO020101/3069217
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="인천광역시",
    sub_entity="인천시청 종합건설본부",
    source_page="알림마당",
    source_url="https://www.incheon.go.kr/jonggeon/JO020101",
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
        if len(tds) < 4:
            continue
        a = tds[1].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(SOURCE.source_url, a.get("href", ""))
        posted_at = parse_date(tds[3].get_text())
        if not title or "/JO020101/" not in detail_url:
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
