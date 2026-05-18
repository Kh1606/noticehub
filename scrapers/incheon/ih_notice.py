"""인천도시공사 공지사항 — ih.co.kr/main/customer/notification/notice.jsp.

Anchor-based listing (no table); simple_list with require='bbsMsgDetail'
picks up the notice detail links. 11 notices locally.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_list import make_list_scrape

_SRC = SourceMeta(
    region="인천광역시", sub_entity="인천도시공사", source_page="공지사항",
    source_url="https://www.ih.co.kr/main/customer/notification/notice.jsp",
)

SCRAPERS = [(_SRC, make_list_scrape(_SRC, require="bbsMsgDetail"))]
