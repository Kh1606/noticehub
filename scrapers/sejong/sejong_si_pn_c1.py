"""세종시청 고시 공고 — sejong.go.kr/prog/publicNotice/kor/sub02_0303/C1/list.do

(v2-specific URL; the older sub02_03_01 path is handled by sejong_si_gosi.py.)

5-col listing: 번호 / 공고번호 / 제목 / 담당부서 / 게시기간
Title anchor lives in td[2], href is `view.do?not_ancmt_mgt_no=ID&pageIndex=1`.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape

_SRC = SourceMeta(
    region="대전광역시", sub_entity="세종시청", source_page="고시 공고",
    source_url="https://www.sejong.go.kr/prog/publicNotice/kor/sub02_0303/C1/list.do",
)

SCRAPERS = [(_SRC, make_scrape(_SRC, title_col=2, require="view.do"))]
