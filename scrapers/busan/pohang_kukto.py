"""포항 국토관리사무소 공지사항 — molit.go.kr/brocm."""
from scrapers.base import SourceMeta
from scrapers._helpers.molit_jsp import scrape_molit_jsp

SOURCE = SourceMeta(
    region="부산광역시",
    sub_entity="포항 국토관리사무소",
    source_page="공지사항",
    source_url="https://www.molit.go.kr/brocm/USR/BORD0201/m_20857/LST.jsp",
)


def scrape():
    return scrape_molit_jsp(SOURCE)
