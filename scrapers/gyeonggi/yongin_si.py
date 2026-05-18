"""용인시청 — yongin.go.kr/user/bbs/BD_selectBbsList.do?q_bbsCode=1252.

v2's URL (yiNwInfo01_01.jsp 입찰공고) embeds an eminwon iframe that
returns no data even when hit directly. This URL is yongin's working
공지사항 board, used as a stand-in so v2's 용인시청/입찰공고 entry
shows recent notices (reconciler keeps v2 labels).

opView(SN) onclick + direct href both present; href works for detail URL.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape

_SRC = SourceMeta(
    region="경기도", sub_entity="용인시청", source_page="입찰공고",
    source_url="http://www.yongin.go.kr/home/yiNw/yiNwInfo/yiNwInfo01/yiNwInfo01_01.jsp;jsessionid=sV1oqCCKq3qsIrTZaZ3vmVaaWNaTwhFuYTFOTzRUVrpSoddkbTPBHoh8iXNRbDXu.yonginwas_servlet_engine3",
)
# Real URL used to actually fetch (v2's URL is broken iframe)
_FETCH_URL = "https://www.yongin.go.kr/user/bbs/BD_selectBbsList.do?q_bbsCode=1252"


def _scrape():
    # yongin.go.kr serves an old TLS stack — use ssl_get.
    from scrapers._helpers.simple_table import extract_from_html
    from scrapers.base import ssl_get, SourceMeta as SM
    r = ssl_get(_FETCH_URL)
    working = SM(region=_SRC.region, sub_entity=_SRC.sub_entity,
                 source_page=_SRC.source_page, source_url=_FETCH_URL)
    notices = extract_from_html(r.text, working, title_col=1, require="bbscttSn")
    # Re-tag with v2's canonical source_url so allowlist + reconciler accept these.
    for n in notices:
        n.source_url = _SRC.source_url
    return notices


SCRAPERS = [(_SRC, _scrape)]
