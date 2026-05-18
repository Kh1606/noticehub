"""충남도청 종합건설사업소 — citynet SAPGosiBizProcess iframe behind
www.chungnam.go.kr/construction/main/contents.do (minwon.chungnam.go.kr)."""
from scrapers.base import SourceMeta
from scrapers._helpers.sap_citynet import make_sap_citynet_scrape


_SRC = SourceMeta(
    region="충청남도", sub_entity="충남도청 종합건설사업소", source_page="공지사항",
    source_url="https://www.chungnam.go.kr/construction/main/contents.do?menuNo=1600016",
)

SCRAPERS = [(_SRC, make_sap_citynet_scrape(_SRC))]
