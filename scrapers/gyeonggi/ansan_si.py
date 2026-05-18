"""안산시청 고시 공고 — ansan.go.kr/.../selectPageListBbs.do?bbs_code=WWW13.

Uses fnGoDetail(ID) onclick pattern; detail URL = selectBbsDetail.do?bbs_seq=ID&bbs_code=...
~15 notices per fetch.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.saeol import make_fn_go_detail_scrape

_SRC = SourceMeta(
    region="경기도", sub_entity="안산시청", source_page="고시 공고",
    source_url="https://www.ansan.go.kr/www/common/bbs/selectPageListBbs.do?bbs_code=WWW13",
)

SCRAPERS = [(_SRC, make_fn_go_detail_scrape(_SRC, title_col=2))]
