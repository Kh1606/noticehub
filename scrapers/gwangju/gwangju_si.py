"""
광주광역시청 고시공고 — gwangju.go.kr/contentsView.do?pageId=www791

The xlsx URL is a portal page whose iframe loads:
  sido.gwangju.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do?command=searchList
This CMS renders a table with <tr onclick="viewData('sno','gbn')"> rows.
Detail URL constructed using searchDetail command on the same citynet host.
"""
from __future__ import annotations
import re

from scrapers.base import Notice, SourceMeta, get, soup as mk_soup, parse_date, clean

SOURCE = SourceMeta(
    region="광주광역시",
    sub_entity="광주시청",
    source_page="고시 공고",
    source_url="https://www.gwangju.go.kr/contentsView.do?pageId=www791",
)

_LIST_URL = (
    "https://sido.gwangju.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do"
    "?command=searchList&flag=gosiGL&svp=Y"
)
_DETAIL_FMT = (
    "https://sido.gwangju.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do"
    "?command=searchDetail&flag=gosiGL&svp=Y&sido=&sno={sno}&gosiGbn={gbn}"
)
_VIEW_RE = re.compile(r"viewData\([\'\"](\d+)[\'\"]\s*,\s*[\'\"]([A-Z])[\'\"]\)")

SCRAPERS = [(SOURCE, None)]  # placeholder, replaced below


def scrape() -> list[Notice]:
    r = get(_LIST_URL)
    bs = mk_soup(r.text)
    tables = bs.find_all("table")
    if not tables:
        return []
    t = max(tables, key=lambda x: len(x.find_all("tr")))
    notices: list[Notice] = []
    for row in t.find_all("tr"):
        onclick = row.get("onclick", "")
        m = _VIEW_RE.search(onclick)
        if not m:
            continue
        tds = row.find_all("td")
        if len(tds) < 2:
            continue
        title = clean(tds[1].get_text())
        if not title:
            continue
        detail_url = _DETAIL_FMT.format(sno=m.group(1), gbn=m.group(2))
        posted_at = parse_date(tds[3].get_text()) if len(tds) > 3 else None
        notices.append(Notice(
            region=SOURCE.region, sub_entity=SOURCE.sub_entity,
            source_page=SOURCE.source_page, source_url=SOURCE.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


SCRAPERS = [(SOURCE, scrape)]
