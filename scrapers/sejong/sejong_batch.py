"""
세종특별자치시 — additional batch sources.

세종시청 고시공고 (sub02_030301/C1_1) — publicNotice board, title col 2 (번호|공고번호|제목|담당|기간).
세종도시교통공사 — bbs/view/BBSS direct links, title col 2 (번호|분류|제목|작성자).
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="세종특별자치시", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


SCRAPERS = [
    # 세종시청 고시공고 — publicNotice board, title col 2 (공고번호 col 1, 제목 col 2)
    _entry("세종시청", "고시공고",
           "https://www.sejong.go.kr/prog/publicNotice/kor/sub02_030301/C1_1/list.do",
           title_col=2, require="not_ancmt_mgt_no"),
    # 세종도시교통공사 공지사항 — direct bbs/view/ links, title col 2 (번호|분류|제목|작성자)
    _entry("세종도시교통공사", "공지사항",
           "https://www.sctc.kr/bbs/BBSS1612021757537630",
           title_col=2, require="bbs/view/BBSS"),
]
