"""평택시청 고시 공고 — pyeongtaek.go.kr/pyeongtaek/saeol/gosi/list.do.

Standard saeol gosi list. 10 notices.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.saeol import make_saeol_scrape

_SRC = SourceMeta(
    region="경기도", sub_entity="평택시청", source_page="고시 공고",
    source_url="https://www.pyeongtaek.go.kr/pyeongtaek/saeol/gosi/list.do?seCode=01&mid=0401020000",
)

SCRAPERS = [(_SRC, make_saeol_scrape(_SRC))]
