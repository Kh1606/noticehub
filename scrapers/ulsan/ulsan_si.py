"""
울산시청 고시 공고 — ulsan.go.kr/u/rep/transfer/notice/list.ulsan

Listing cols: 번호 / 제목 / 담당부서 / 전화 / 공고번호 / 게시일자
Date col 5. Detail link relative: ./46250.ulsan?mId=...&gosiGbn=A
"""
from urllib.parse import urljoin
from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="울산광역시",
    sub_entity="울산시청",
    source_page="고시 공고",
    source_url="https://www.ulsan.go.kr/u/rep/transfer/notice/list.ulsan",
)


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
    s = soup(r.content)
    table = s.find("table")
    if not table:
        return []
    notices = []
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
        posted_at = parse_date(tds[5].get_text())
        if not title or "ulsan" not in detail_url:
            continue
        notices.append(Notice(
            region=SOURCE.region, sub_entity=SOURCE.sub_entity,
            source_page=SOURCE.source_page, source_url=SOURCE.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices
