"""김천시청 고시공고 — gc.go.kr/portal/saeol/gosi/list.do (saeol pattern).

v2 groups 김천시 under 대구광역시 in the xlsx merge layout (geographically
경상북도). The reconciler in run_all.py will normalize region/sub_entity
to match src/data/regions.json regardless of how we label it here.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.saeol import make_saeol_scrape

_SRC = SourceMeta(
    region="대구광역시", sub_entity="김천시청", source_page="고시 공고",
    source_url="https://www.gc.go.kr/portal/saeol/gosi/list.do?seCode=01&mId=1202180100",
)

SCRAPERS = [(_SRC, make_saeol_scrape(_SRC))]
