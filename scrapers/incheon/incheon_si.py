"""
인천시청 고시 공고 — announce.incheon.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do

Page nests many tables (frame layout). The actual listing is the table whose
header row contains '고시/공고 번호'. Rows have NO <a> on the title — instead
the <tr> itself carries `onclick="viewData('66148','A')"`. We synthesize:
  /citynet/jsp/sap/SAPGosiBizProcess.do?command=searchDetail&flag=gosiGL&svp=Y&sido=ic&sno=<sno>&gosiGbn=<gbn>
"""
from __future__ import annotations
import re

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="인천광역시",
    sub_entity="인천시청",
    source_page="고시 공고",
    source_url=(
        "http://announce.incheon.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do"
        "?command=searchList&flag=gosiGL&svp=Y&sido=ic&sgg=ic"
    ),
)
DETAIL_FMT = (
    "http://announce.incheon.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do"
    "?command=searchDetail&flag=gosiGL&svp=Y&sido=ic&sno={sno}&gosiGbn={gbn}"
)
_VIEW_RE = re.compile(r"viewData\([\'\"](\d+)[\'\"]\s*,\s*[\'\"]([A-Z])[\'\"]\)")


def _is_listing(table) -> bool:
    head = table.find("tr")
    if not head:
        return False
    head_text = head.get_text(" ", strip=True)
    return "고시/공고 번호" in head_text and "제목" in head_text and "게재일자" in head_text


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
    s = soup(r.content)
    table = next((t for t in s.find_all("table") if _is_listing(t)), None)
    if not table:
        return []

    notices: list[Notice] = []
    body = table.find("tbody") or table
    for tr in body.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue
        m = _VIEW_RE.search(tr.get("onclick") or "")
        if not m:
            continue
        title = clean(tds[1].get_text())
        if not title:
            continue
        detail_url = DETAIL_FMT.format(sno=m.group(1), gbn=m.group(2))
        posted_at = parse_date(tds[3].get_text())
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
