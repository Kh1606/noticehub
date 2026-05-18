"""
제주도청 고시 공고 — two board URLs:
  jeju.htm  — citynet template (<tr onclick="viewData(...)">)
  jeju2.htm — Vue.js SPA backed by /tool/sido/api.jsp JSON endpoint
"""
from __future__ import annotations
import re

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

_SRC_HTM = SourceMeta(
    region="제주도",
    sub_entity="제주도청",
    source_page="고시 공고",
    source_url="http://www.jeju.go.kr/news/news/law/jeju.htm",
)
_SRC_HTM2 = SourceMeta(
    region="제주도",
    sub_entity="제주도청",
    source_page="고시 공고 (2)",
    source_url="http://www.jeju.go.kr/news/news/law/jeju2.htm",
)

DETAIL_FMT = (
    "http://www.jeju.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do"
    "?command=searchDetail&flag=gosiGL&svp=Y&sido=&sno={sno}&gosiGbn={gbn}"
)
_VIEW_RE = re.compile(r"viewData\([\'\"](\d+)[\'\"]\s*,\s*[\'\"]([A-Z])[\'\"]\)")
_API_URL = "http://www.jeju.go.kr/tool/sido/api.jsp"

# kept for legacy imports
SOURCE = _SRC_HTM


def _is_listing(table) -> bool:
    head = table.find("tr")
    if not head:
        return False
    head_text = head.get_text(" ", strip=True)
    return "고시" in head_text and "제목" in head_text and ("게재일자" in head_text or "게재일" in head_text)


def _scrape_htm() -> list[Notice]:
    r = get(_SRC_HTM.source_url)
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
        notices.append(Notice(
            region=_SRC_HTM.region, sub_entity=_SRC_HTM.sub_entity,
            source_page=_SRC_HTM.source_page, source_url=_SRC_HTM.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


def _scrape_htm2() -> list[Notice]:
    r = get(_API_URL, params={"act": "index", "page": 1})
    try:
        data = r.json()
    except Exception:
        return []
    gosis = data.get("gosis") or []
    notices: list[Notice] = []
    for g in gosis:
        title = clean(g.get("title", ""))
        if not title:
            continue
        gb = g.get("gb", "")
        no = g.get("no", "")
        detail_url = f"{_SRC_HTM2.source_url}#{gb}_{no}"
        posted_at = parse_date(g.get("date", ""))
        notices.append(Notice(
            region=_SRC_HTM2.region, sub_entity=_SRC_HTM2.sub_entity,
            source_page=_SRC_HTM2.source_page, source_url=_SRC_HTM2.source_url,
            detail_url=detail_url, title=title, posted_at=posted_at,
        ))
    return notices


SCRAPERS = [
    (_SRC_HTM, _scrape_htm),
    (_SRC_HTM2, _scrape_htm2),
]


def scrape() -> list[Notice]:
    return _scrape_htm()
