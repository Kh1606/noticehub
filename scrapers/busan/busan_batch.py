"""
부산광역시 — additional batch sources not covered by individual scrapers.

부산도시공사 — was marked 404 with old URL; board/list2.do is the working endpoint.
부산지방국토관리청 — molit.go.kr/brocm:
  공지사항 LST.jsp (m_20580): title in tds[1] → molit_jsp helper
  고시공고 BRD.jsp (m_15109): title in tds[2] → make_scrape title_col=2
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape
from scrapers._helpers.molit_jsp import scrape_molit_jsp


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="부산광역시", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _molit(sub, page, url):
    src = SourceMeta(region="부산광역시", sub_entity=sub, source_page=page, source_url=url)
    return src, (lambda s=src: scrape_molit_jsp(s))


SCRAPERS = [
    # 부산도시공사 — board/list2.do, title col 1; view.do?boardId= distinguishes detail
    _entry("부산도시공사", "공지사항",
           "https://www.bmc.busan.kr/board/list2.do?boardId=BBS_0000001&menuCd=DOM_000000101001001000&contentsSid=25&cpath=",
           require="view.do?boardId=BBS_0000001"),
    # 부산지방국토관리청 공지사항 — LST.jsp; title in tds[1]
    _molit("부산지방국토관리청", "알림공고",
           "https://www.molit.go.kr/brocm/USR/BORD0201/m_20580/LST.jsp"),
    # 부산지방국토관리청 고시공고 — BRD.jsp; col num|고시구분|제목|날짜|담당|조회 → title_col=2
    _entry("부산지방국토관리청", "고시공고",
           "https://www.molit.go.kr/brocm/USR/BORD0201/m_15109/BRD.jsp",
           title_col=2, require="DTL"),
]
