"""
세종시청 고시 공고 — sejong.go.kr/prog/publicNotice/kor/sub02_03_01/list.do

5-column listing: 번호 / 공고번호 / 제목 / 담당부서 / 게시기간
Title is at column index 2. The 게시기간 column is a date range
"YYYY-MM-DD ~ YYYY-MM-DD"; parse_date picks up the first date naturally.
Detail link: /prog/publicNotice/.../view.do?not_ancmt_mgt_no=...
"""
from urllib.parse import urljoin
from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="세종특별시",
    sub_entity="세종시청",
    source_page="고시 공고",
    source_url="https://www.sejong.go.kr/prog/publicNotice/kor/sub02_03_01/list.do",
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
        a = tds[2].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(SOURCE.source_url, a.get("href", ""))
        posted_at = parse_date(tds[4].get_text())
        if not title or "not_ancmt_mgt_no" not in detail_url:
            continue
        notices.append(Notice(
            region=SOURCE.region, sub_entity=SOURCE.sub_entity,
            source_page=SOURCE.source_page, source_url=SOURCE.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices
