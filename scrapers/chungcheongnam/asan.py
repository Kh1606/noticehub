"""
아산시 공지사항 — https://www.asan.go.kr/main/cms/?no=131

CMS pattern: single <table> with caption '[공지사항:total/page]번호,제목,첨부,작성일,...'.
Detail link is a relative href on the title <a>:
  ?tb_nm=city_news_notice&m_mode=view&pds_no=2026050414331960529&PageNo=1&no=131
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="충청남도",
    sub_entity="아산시",
    source_page="공지사항",
    source_url="https://www.asan.go.kr/main/cms/?no=131",
)


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
    s = soup(r.content)

    table = s.find("table")
    if not table:
        return []

    notices: list[Notice] = []
    for tr in table.find("tbody").find_all("tr") if table.find("tbody") else table.find_all("tr")[1:]:
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue
        a = tds[1].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        href = a.get("href", "")
        detail_url = urljoin(SOURCE.source_url, href)
        posted_at = parse_date(tds[3].get_text())
        if not title or not detail_url:
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
