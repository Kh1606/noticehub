"""진주 국토관리사무소 공지사항 — molit.go.kr/brocm (부산국토관리청 산하)."""
from scrapers.base import SourceMeta
from scrapers._helpers.molit_jsp import scrape_molit_jsp

SOURCE = SourceMeta(
    region="부산광역시",
    sub_entity="진주 국토관리사무소",
    source_page="공지사항",
    source_url="https://www.molit.go.kr/brocm/USR/BORD0201/m_20654/LST.jsp",
)


def scrape():
    return scrape_molit_jsp(SOURCE)
