"""
울산도시공사 공지사항 — umca.co.kr/umca/bbs/list.do

Listing cols: 번호 / 제목 / 조회수 / 첨부파일 / 작성일자
Date col 4. Detail link relative: ./view.do?mId=...&bbsId=...&dataId=...
"""
from urllib.parse import urljoin
from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="울산광역시",
    sub_entity="울산도시공사",
    source_page="공지사항",
    source_url="https://www.umca.co.kr/umca/bbs/list.do?bbsId=BBS_0000000000000003",
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
        if not title or "dataId" not in detail_url:
            continue
        notices.append(Notice(
            region=SOURCE.region, sub_entity=SOURCE.sub_entity,
            source_page=SOURCE.source_page, source_url=SOURCE.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices
