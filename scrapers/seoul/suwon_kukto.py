"""
서울지방국토관리청 산하 국토관리사무소 공지사항 — molit.go.kr/srocm

Boards: 수원, 의정부 LST.jsp boards (auto-detected date col via molit_jsp helper)
서울지방국토관리청 BRD.jsp (m_13078) — col num|고시구분|제목|날짜|담당|조회 → title_col=2
"""
from scrapers.base import SourceMeta
from scrapers._helpers.molit_jsp import scrape_molit_jsp
from scrapers._helpers.simple_table import make_scrape


def _molit(sub, page, url):
    src = SourceMeta(region="서울특별시", sub_entity=sub, source_page=page, source_url=url)
    return src, (lambda s=src: scrape_molit_jsp(s))


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="서울특별시", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


SCRAPERS = [
    _molit("수원 국토관리사무소", "공지사항",
           "https://www.molit.go.kr/srocm/USR/BORD0201/m_19696/LST.jsp"),
    _molit("의정부 국토관리사무소", "공지사항",
           "https://www.molit.go.kr/srocm/USR/BORD0201/m_19896/LST.jsp"),
    # 서울지방국토관리청 고시공고 — BRD.jsp; col num|고시구분|제목|날짜|담당|조회 → title_col=2
    _entry("서울지방국토관리청", "고시공고",
           "https://www.molit.go.kr/srocm/USR/BORD0201/m_13078/BRD.jsp",
           title_col=2, require="DTL"),
]

# kept for legacy imports
SOURCE = SCRAPERS[0][0]


def scrape():
    return SCRAPERS[0][1]()
