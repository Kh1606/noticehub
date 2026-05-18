"""보은 국토관리사무소 공지사항 — molit.go.kr/drocm."""
from scrapers.base import SourceMeta
from scrapers._helpers.molit_jsp import scrape_molit_jsp

SOURCE = SourceMeta(
    region="대전광역시",
    sub_entity="보은 국토관리사무소",
    source_page="공지사항",
    source_url="http://www.molit.go.kr/drocm/USR/BORD0201/m_20398/LST.jsp",
)

def scrape():
    return scrape_molit_jsp(SOURCE)
