"""의왕시 고시 공고 — uiwang.go.kr/UWKORINFO0701 (eminwon iframe).

Parent page embeds eminwon.uiwang.go.kr; the generic eminwon helper
discovers the iframe and reads the 고시공고 list. 10 notices.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.eminwon_iframe import make_eminwon_iframe_scrape

_SRC = SourceMeta(
    region="경기도", sub_entity="의왕시", source_page="고시 공고",
    source_url="http://www.uiwang.go.kr/UWKORINFO0701",
)

SCRAPERS = [(_SRC, make_eminwon_iframe_scrape(_SRC))]
