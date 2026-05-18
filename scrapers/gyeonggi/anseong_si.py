"""안성시 고시 공고 — anseong.go.kr/portal/saeol/gosiList.do?mId=0501040000.

Standard saeol gosi list. 10 notices.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.saeol import make_saeol_scrape

_SRC = SourceMeta(
    region="경기도", sub_entity="안성시", source_page="고시 공고",
    source_url="https://www.anseong.go.kr/portal/saeol/gosiList.do?mId=0501040000",
)

SCRAPERS = [(_SRC, make_saeol_scrape(_SRC))]
