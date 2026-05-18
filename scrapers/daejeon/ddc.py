"""
대전 DDC 공지사항 — ddc.go.kr/ddc/selectBbsNttList.do?bbsNo=24&key=104

eGovFrame selectBbsNttList/selectBbsNttView pattern, title col 1.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape

SOURCE = SourceMeta(
    region="대전광역시",
    sub_entity="대전디지털진흥원",
    source_page="공지사항",
    source_url="https://www.ddc.go.kr/ddc/selectBbsNttList.do?bbsNo=24&key=104",
)

scrape = make_scrape(SOURCE, require="selectBbsNttView")
