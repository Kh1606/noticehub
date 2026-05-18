"""광주시청 도시건설본부 새소식 — gwangju.go.kr/build/boardList.do.

Lists are anchor-based (no <table>). simple_list.scrape_simple_list with
require='boardView' picks up exactly the 10 notice links per page.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_list import make_list_scrape

_SRC = SourceMeta(
    region="광주광역시", sub_entity="광주시청 도시건설본부", source_page="새소식",
    source_url="https://www.gwangju.go.kr/build/boardList.do?boardId=BD_0000000156&pageId=build9",
)

SCRAPERS = [(_SRC, make_list_scrape(_SRC, require="boardView"))]
