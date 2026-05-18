"""성남시청 공시 공고 — seongnam.go.kr/notice/publicNotice.do (eminwon iframe).

The page hosts an eminwon iframe; helper handles both phases (try as-is,
fall back to parameterized JSP). 10 notices locally.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.eminwon_iframe import make_eminwon_iframe_scrape

_SRC = SourceMeta(
    region="경기도", sub_entity="성남시청", source_page="공시 공고",
    # version2.xlsx URL contains &amp; — keep it that way so the v2
    # allowlist + reconciler treat it as the v2-canonical entry.
    source_url="https://www.seongnam.go.kr/notice/publicNotice.do?menuIdx=1000499&amp;returnURL=%2Fmain.do",
)

SCRAPERS = [(_SRC, make_eminwon_iframe_scrape(_SRC))]
