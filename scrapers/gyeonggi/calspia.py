"""건설신기술특허플랫폼 — calspia.go.kr/portal/cnpp/viewCnppCnmtRcrPsu.do (jqGrid).

Row cells: [no, org, type, title, deadline, status, uid_scmd, ...].
Unique ID is the SCMD_... value in cell 6.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.jqgrid import make_jqgrid_scrape

_SRC = SourceMeta(
    region="기타", sub_entity="건설신기술특허플랫폼", source_page="특정공법 후보모집",
    source_url="https://www.calspia.go.kr/portal/cnpp/viewCnppCnmtRcrPsu.do",
)

SCRAPERS = [(_SRC, make_jqgrid_scrape(_SRC, title_col=3, date_col=4, uid_col=6))]
