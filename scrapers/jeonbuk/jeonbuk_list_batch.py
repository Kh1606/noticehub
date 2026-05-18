"""
전라북도 — non-table list-layout sites (simple_list helper).

These CMSes (list.jinan / list.jangsu / list.gochang) render article rows as
<ul>/<li>/<div> instead of <table>, so simple_table.py returns nothing.
simple_list.py filters by <a href> containing the require substring instead.

Skipped:
  진안군 고시공고 (BBS_0000144) — <a> tags have empty text; title is not
      inside the link element, so simple_list cannot extract it.
  장수군 고시공고 — index.jangsu?menuCd=...005000 maps to a tourism menu page
      (BBS_0000004 = 공원/휴양림/관광지), not a gosi board. Wrong content.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_list import make_list_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="전라북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_list_scrape(src, **opts)


SCRAPERS = [
    # 진안군 공지사항 — list.jinan CMS, boardId=BBS_0000026
    _entry("진안군", "공지사항",
           "https://www.jinan.go.kr/board/list.jinan?boardId=BBS_0000026&menuCd=DOM_000000107001001000&contentsSid=179&cpath=",
           require="view.jinan?boardId=BBS_0000026"),
    # 장수군 공지사항 — list.jangsu CMS, boardId=BBS_0000003
    _entry("장수군", "공지사항",
           "https://www.jangsu.go.kr/board/list.jangsu?boardId=BBS_0000003&menuCd=DOM_000000102001001000&contentsSid=13&cpath=",
           require="view.jangsu?boardId=BBS_0000003"),
    # 고창군 공지사항 — list.gochang CMS, boardId=BBS_0000083
    _entry("고창군", "공지사항",
           "https://www.gochang.go.kr/board/list.gochang?boardId=BBS_0000083&menuCd=DOM_000000102001001000&contentsSid=234&cpath=",
           require="view.gochang?boardId=BBS_0000083"),
    # 고창군 고시공고 — list.gochang CMS, boardId=BBS_0000180
    _entry("고창군", "고시공고",
           "https://www.gochang.go.kr/board/list.gochang?boardId=BBS_0000180&menuCd=DOM_000000102003007000&contentsSid=2682&cpath=",
           require="view.gochang?boardId=BBS_0000180"),
]
