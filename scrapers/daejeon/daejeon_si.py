"""
대전시청 고시 공고 — https://www.daejeon.go.kr/drh/drhGosiList.do?gosigbn=A&menuSeq=1908

eGov-style listing. The page has TWO tables: a search-form table and the listing.
We pick the listing by caption text containing "목록" / "공고".
Detail link is a relative href: /drh/drhGosiView.do?...
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="대전광역시",
    sub_entity="대전시청",
    source_page="고시 공고",
    source_url="https://www.daejeon.go.kr/drh/drhGosiList.do?gosigbn=A&menuSeq=1908",
)


def _is_listing(table) -> bool:
    cap = table.caption.get_text(" ", strip=True) if table.caption else ""
    return "목록" in cap or "공고" in cap and "검색" not in cap


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
    s = soup(r.content)

    listing = next((t for t in s.find_all("table") if _is_listing(t)), None)
    if listing is None:
        return []

    notices: list[Notice] = []
    body = listing.find("tbody") or listing
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
        if not title or "drhGosiView" not in detail_url:
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
