"""인천시청 고시공고 — citynet SAPGosiBizProcess (announce.incheon.go.kr)."""
from scrapers.base import SourceMeta
from scrapers._helpers.sap_citynet import make_sap_citynet_scrape


_SRC = SourceMeta(
    region="인천광역시", sub_entity="인천시청", source_page="고시 공고",
    source_url="http://announce.incheon.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do?command=searchList&flag=gosiGL&svp=Y&sido=ic",
)

SCRAPERS = [(_SRC, make_sap_citynet_scrape(_SRC))]
