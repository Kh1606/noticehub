"""
서울시설관리공단 — sisul.or.kr

Boards:
  알림마당  — introduce/notice.jsp, bbsMsgDetail.do links, title col 1
  선정공고  — govern30/contract/specific.jsp, bbsMsgDetail.do links, title col 1
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape


def _entry(page, url):
    src = SourceMeta(
        region="서울특별시",
        sub_entity="서울시설관리공단",
        source_page=page,
        source_url=url,
    )
    return src, make_scrape(src, require="bbsMsgDetail.do")


SCRAPERS = [
    _entry("알림마당",
           "https://www.sisul.or.kr/open_content/main/introduce/notice.jsp"),
    _entry("선정공고",
           "https://www.sisul.or.kr/open_content/main/govern30/contract/specific.jsp"),
]

# kept for direct invocation / legacy imports
SOURCE = SCRAPERS[0][0]


def scrape():
    return SCRAPERS[0][1]()
