"""한국수자원공사 공지사항 — kwater.or.kr/news/sub01/noti01List.do?brdId=KO27.

Standard table; 11 rows; title anchor in col 3; detail href includes noti01View.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape

_SRC = SourceMeta(
    region="공사", sub_entity="한국수자원공사(물산업플랫폼)", source_page="공지사항",
    source_url="https://www.kwater.or.kr/news/sub01/noti01List.do?s_mid=105&brdId=KO27",
)

SCRAPERS = [(_SRC, make_scrape(_SRC, title_col=3, require="noti01View"))]
