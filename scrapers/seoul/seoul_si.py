"""
서울시청 공고 — https://www.seoul.go.kr/news/news_notice.do

Listing has a <table>, but row links use a JS handler:
  href="javascript:fnTbbsView('457365');"

The site's own JS reconstructs the URL as `?bbsNo=<bbsNo>&nttNo=<nttNo>`.
We extract bbsNo from the page (a JS var), then synthesize detail URLs.
"""
from __future__ import annotations
import re

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="서울특별시",
    sub_entity="서울시청",
    source_page="공고",
    source_url="https://www.seoul.go.kr/news/news_notice.do",
)

_BBS_NO_RE = re.compile(r"bbsNo\s*=\s*[\'\"]?(\d+)[\'\"]?")
_NTT_NO_RE = re.compile(r"fnTbbsView\([\'\"]?(\d+)[\'\"]?\)")


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
    text = r.text

    m = _BBS_NO_RE.search(text)
    if not m:
        return []
    bbs_no = m.group(1)

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

        # Extract nttNo from "javascript:fnTbbsView('457365');"
        href = a.get("href") or ""
        onclick = a.get("onclick") or ""
        m2 = _NTT_NO_RE.search(href) or _NTT_NO_RE.search(onclick)
        if not m2:
            continue
        ntt_no = m2.group(1)

        title = clean(a.get_text())
        detail_url = f"{SOURCE.source_url}?bbsNo={bbs_no}&nttNo={ntt_no}"
        posted_at = parse_date(tds[3].get_text())
        if not title:
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
