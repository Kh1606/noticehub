"""
제주특별자치도개발공사 (JPDC) 공지사항 — jpdc.co.kr/open/news/notice.htm

Listing cols: 번호 / 제목 / 첨부 / 작성자 / 작성일 / 조회
Date col 4. Detail link: /open/news/notice.htm?act=view&seq=...
"""
from urllib.parse import urljoin
from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="제주도",
    sub_entity="제주도개발공사",
    source_page="공지사항",
    source_url="https://www.jpdc.co.kr/open/news/notice.htm",
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
        if len(tds) < 5:
            continue
        a = tds[1].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(SOURCE.source_url, a.get("href", ""))
        posted_at = parse_date(tds[4].get_text())
        if not title or "act=view" not in detail_url:
            continue
        notices.append(Notice(
            region=SOURCE.region, sub_entity=SOURCE.sub_entity,
            source_page=SOURCE.source_page, source_url=SOURCE.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices
