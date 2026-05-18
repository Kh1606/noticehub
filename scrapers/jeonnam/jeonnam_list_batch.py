"""
전라남도 — non-table list-layout sites (simple_list helper).

고흥군 and 함평군 use boardList.do / boardView.do with no <table> in the HTML.
simple_list.py filters by <a href> containing the require substring.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_list import make_list_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="전라남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_list_scrape(src, **opts)


SCRAPERS = [
    # 고흥군 공지사항 — boardList.do / boardView.do CMS
    _entry("고흥군", "공지사항",
           "https://www.goheung.go.kr/boardList.do?pageId=www96&boardId=BD_00018",
           require="boardView.do?pageId=www96&boardId=BD_00018"),
    # 함평군 공지사항 — boardList.do / boardView.do CMS
    _entry("함평군", "공지사항",
           "https://www.hampyeong.go.kr/boardList.do?pageId=www272&boardId=NOTICE",
           require="boardView.do?pageId=www272&boardId=NOTICE"),
]
