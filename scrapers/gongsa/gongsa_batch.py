"""
전국 공사/공단 — national agencies listed in Sheet1 "공사" section.

Skipped:
  물산업플랫폼 kwater.or.kr (XML-based / no HTML table)
  한국도로공사 ex.co.kr (jsessionid URL, session-based)
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape
from scrapers._helpers.saeol import make_go_view3_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="공사", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _gv3(sub, page, url, **opts):
    src = SourceMeta(region="공사", sub_entity=sub, source_page=page, source_url=url)
    return src, make_go_view3_scrape(src, **opts)


SCRAPERS = [
    # 농어촌공사 — 9is/krc CMS, title col 1
    _entry("농어촌공사", "공지사항",
           "https://www.ekr.or.kr/planweb/board/list.krc?contentUid=402880317cc0644a017cc0c22f2800f0&boardUid=402880317cc0644a017cc463cec202be&contentUid=402880317cc0644a017cc0c22f2800f0&subPath=",
           require="view.krc"),
    # LH공사 — board.es CMS; goView3 onclick; title col 3 (알림|공지|알림|제목)
    _gv3("LH공사", "공지사항",
         "https://www.lh.or.kr/board.es?mid=a10601010000&bid=0033",
         title_col=3),
]
