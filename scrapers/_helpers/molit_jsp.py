"""
Shared parser for molit.go.kr JSP-style notice boards.

These boards (수원/진주/대구/포항/영주 국토관리사무소 etc.) all use the same
template:

  <table>
    <thead>...</thead>
    <tbody>
      <tr>
        <td>번호</td>
        <td><a href="./DTL.jsp?...idx=12345">제목</a></td>
        <td>(이름 OR 담당부서)</td>   ← optional, swaps date col index
        <td>등록일자 / 작성일</td>     ← date column
        <td>조회</td>
      </tr>
    </tbody>
  </table>

The date column is sometimes index 2 (수원/대구) and sometimes index 3
(진주/포항/영주). We auto-detect by scanning all cells from index 2 onward
and taking the first one parse_date can resolve.
"""
from __future__ import annotations
from urllib.parse import urljoin

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean


def scrape_molit_jsp(source: SourceMeta) -> list[Notice]:
    r = get(source.source_url)
    s = soup(r.content)
    table = s.find("table")
    if not table:
        return []

    notices: list[Notice] = []
    body = table.find("tbody") or table
    for tr in body.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue
        a = tds[1].find("a")
        if not a:
            continue
        title = clean(a.get_text())
        detail_url = urljoin(source.source_url, a.get("href", ""))
        if not title or "DTL" not in detail_url:
            continue
        # Auto-detect date column: first cell from index 2 onward that parses.
        posted_at = next(
            (parse_date(td.get_text()) for td in tds[2:] if parse_date(td.get_text())),
            None,
        )
        notices.append(
            Notice(
                region=source.region,
                sub_entity=source.sub_entity,
                source_page=source.source_page,
                source_url=source.source_url,
                detail_url=detail_url,
                title=title,
                posted_at=posted_at,
            )
        )
    return notices
