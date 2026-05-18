"""
세종시청 공지사항 — sejong.go.kr/bbs/R0071/list.do

7-column listing: 번호 / 문자안내 / 제목 / 작성자 / 조회 / 등록일 / 첨부
Title is at column index 2 (after 번호 and 문자안내). Date at index 5.
Detail link: /bbs/R0071/view.do?nttId=B...
"""
from urllib.parse import urljoin
from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="세종특별시",
    sub_entity="세종시청",
    source_page="공지사항",
    source_url="https://www.sejong.go.kr/bbs/R0071/list.do",
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
        a = tds[2].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(SOURCE.source_url, a.get("href", ""))
        posted_at = parse_date(tds[5].get_text())
        if not title or "/view.do" not in detail_url:
            continue
        notices.append(Notice(
            region=SOURCE.region, sub_entity=SOURCE.sub_entity,
            source_page=SOURCE.source_page, source_url=SOURCE.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices
