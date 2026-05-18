"""대전지방국토관리청 알림마당 — molit.go.kr/drocm."""
from scrapers.base import SourceMeta
from scrapers._helpers.molit_jsp import scrape_molit_jsp

SOURCE = SourceMeta(
    region="대전광역시",
    sub_entity="대전지방국토관리청",
    source_page="알림마당",
    source_url="http://www.molit.go.kr/drocm/USR/BORD0201/m_16064/BRD.jsp",
)

def scrape():
    return scrape_molit_jsp(SOURCE)
