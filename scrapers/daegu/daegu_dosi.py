"""
대구도시공사 공지사항 — daegu.go.kr/index.do?menu_id=00000854

The list page renders a 6-column table:
  번호 / 제목 / 부서명 / 등록일 / 첨부 / 조회

Title cell uses `href="javascript:;" onclick="fn_icms_navi_common('view','795620')"`.
We synthesize a GET-style detail URL:
  /index.do?menu_id=00000854&menu_link=/icms/bbs/selectBoardArticle.do&bbsId=BBS_00029&nttId=<id>
(bbsId BBS_00029 is read off the form's hidden inputs.)
"""
from __future__ import annotations
import re

from scrapers.base import Notice, SourceMeta, get, soup, parse_date, clean

SOURCE = SourceMeta(
    region="대구광역시",
    sub_entity="대구도시공사",
    source_page="공지사항",
    source_url="https://www.daegu.go.kr/index.do?menu_id=00000854&servletPath=%2Findex.do",
)
DETAIL_FMT = (
    "https://www.daegu.go.kr/index.do?menu_id=00000854"
    "&menu_link=/icms/bbs/selectBoardArticle.do&bbsId=BBS_00029&nttId={ntt}"
)
_NTT_RE = re.compile(r"fn_icms_navi_common\([\'\"]view[\'\"]\s*,\s*[\'\"]?(\d+)[\'\"]?\)")


def scrape() -> list[Notice]:
    r = get(SOURCE.source_url)
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
        m = _NTT_RE.search(a.get("onclick") or "")
        if not m:
            continue
        title = clean(a.get_text())
        detail_url = DETAIL_FMT.format(ntt=m.group(1))
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
