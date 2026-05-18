"""인천도시공사 입찰공고 — ih.co.kr/main/sale_lease/board/shopping_notice.jsp.

Anchor-based listing (no <table>); simple_list with require='bbsMsgDetail'
picks up exactly the notice links pointing at bbsMsgDetail.do?msg_seq=N.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_list import make_list_scrape

_SRC = SourceMeta(
    region="인천광역시", sub_entity="인천도시공사", source_page="입찰공고",
    source_url="https://www.ih.co.kr/main/sale_lease/board/shopping_notice.jsp",
)

SCRAPERS = [(_SRC, make_list_scrape(_SRC, require="bbsMsgDetail"))]
