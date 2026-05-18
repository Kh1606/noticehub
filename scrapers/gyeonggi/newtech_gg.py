"""경기도 신기술 플랫폼 — newtech.gg.go.kr/main/pblanNow.do (jqGrid).

Row cells: [no, notice_no, title, dept, author, ?, date, views, ?, uid_timestamp].
Detail navigation requires double-click + form POST, so we use the
unique 10th-cell timestamp as a synthetic notice_id.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.jqgrid import make_jqgrid_scrape

_SRC = SourceMeta(
    region="기타", sub_entity="경기도 신기술 플랫폼", source_page="공법선정안내공고",
    source_url="https://newtech.gg.go.kr/main/pblanNow.do",
)

SCRAPERS = [(_SRC, make_jqgrid_scrape(_SRC, title_col=2, date_col=6, uid_col=9))]
