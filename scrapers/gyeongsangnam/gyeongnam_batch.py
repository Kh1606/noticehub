"""
경상남도 — batch of sites.

Skipped (JS-rendered / 404 / NO TABLES):
  창원시×2, 진주시×2, 김해시×2, 통영시×2, 사천시×2, 밀양시 공지,
  함안군×2, 창녕군×2, 하동군×2, 함양군×2, 거창군×2, 합천군×2
  (portal/saeol JS, .web NO TABLES)

경남도청 도로관리사업소 — board/list.gyeong, street/board/view.gyeong detail links
경남도청 고시공고 — index.gyeong CMS, conGosiGbn param in detail hrefs, title col 2
밀양시 고시 — eMiryangMinwonList board, eMiryangMinwonView detail links, title col 2
의령군 고시 — board/list.uiryeong, board/view.uiryeong detail links
거제시 공지 — board/list.geoje, board/view.geoje detail links
거제시 고시 — index.geoje CMS, m=D param in detail hrefs
고성군 공지 — board/list.goseong, board/view.goseong detail links
산청군 공지+고시 — selectBbsNttList CMS, selectBbsNttView detail links
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape, make_ssl_scrape
from scrapers._helpers.simple_list import make_list_scrape
from scrapers._helpers.saeol import make_saeol_scrape, make_portal_board_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="경상남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _ssl_entry(sub, page, url, **opts):
    src = SourceMeta(region="경상남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_ssl_scrape(src, **opts)


def _saeol(sub, page, url):
    src = SourceMeta(region="경상남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_saeol_scrape(src)


def _list(sub, page, url, **opts):
    src = SourceMeta(region="경상남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_list_scrape(src, **opts)


def _board(sub, page, url):
    src = SourceMeta(region="경상남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_portal_board_scrape(src)


SCRAPERS = [
    # ── saeol portal 고시공고 ──────────────────────────────────────────────
    _saeol("양산시", "고시공고",
           "https://www.yangsan.go.kr/portal/saeol/gosi/list.do?mid=0102010000"),
    # 경남도청 도로관리사업소 — board/list.gyeong, title col 1
    _entry("경남도청 도로관리사업소", "열린마당",
           "https://www.gyeongnam.go.kr/board/list.gyeong?boardId=BBS_0000020&menuCd=DOM_000000704001000000",
           require="board/view.gyeong"),
    # 경남도청 고시공고 — index.gyeong CMS, title col 2
    _entry("경남도청", "고시공고",
           "https://www.gyeongnam.go.kr/index.gyeong?menuCd=DOM_000000135003009001",
           title_col=2, require="conGosiGbn"),
    # 밀양시 고시 — eMiryangMinwonList board, title col 2
    _entry("밀양시", "고시공고",
           "https://www.miryang.go.kr/web/eMiryangMinwonList.do?mnNo=20903000000",
           title_col=2, require="eMiryangMinwonView"),
    # 의령군 고시 — board/list.uiryeong, title col 1
    _entry("의령군", "고시공고",
           "http://www.uiryeong.go.kr/board/list.uiryeong?boardId=BBS_0000070&menuCd=DOM_000000403010001001&contentsSid=606&cpath=",
           require="board/view.uiryeong"),
    # 거제시 공지 + 고시 — board/list.geoje (공지), index.geoje (고시)
    _entry("거제시", "공지사항",
           "https://www.geoje.go.kr/board/list.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000",
           require="board/view.geoje"),
    _entry("거제시", "고시공고",
           "https://www.geoje.go.kr/index.geoje?menuCd=DOM_000008902001002001",
           require="m=D"),
    # 의령군 공지사항 — board/list.uiryeong, title col 1
    _entry("의령군", "공지사항",
           "http://www.uiryeong.go.kr/board/list.uiryeong?boardId=BBS_0000085&menuCd=DOM_000000203001001000&contentsSid=185",
           require="view.uiryeong"),
    # 고성군 공지 — board/list.goseong, title col 1
    _entry("고성군", "공지사항",
           "https://www.goseong.go.kr/board/list.goseong?boardId=BBS_0000118&menuCd=DOM_000000102002001000&contentsSid=28&cpath=",
           require="board/view.goseong"),
    # 고성군 고시공고 — same site, col 2 (번호|고시공고번호|제목)
    _entry("고성군", "고시공고",
           "https://www.goseong.go.kr/board/list.goseong?boardId=BBS_0000015&menuCd=DOM_000000103001014000&contentsSid=29&cpath=",
           title_col=2, require="view.goseong"),
    # 산청군 공지+고시 — selectBbsNttList CMS
    _entry("산청군", "공지사항",
           "https://www.sancheong.go.kr/www/selectBbsNttList.do?bbsNo=1&key=157",
           require="selectBbsNttView"),
    _entry("산청군", "고시공고",
           "https://www.sancheong.go.kr/www/selectBbsNttList.do?bbsNo=118&key=158",
           title_col=2, require="selectBbsNttView"),
    # 양산시 공지사항 — portal/board/post, data-req-get-p-idx pattern
    _board("양산시", "공지사항",
           "https://www.yangsan.go.kr/portal/board/post/list.do?bcIdx=293&mid=0101010000"),
    # 남해군 공지사항 — socialm board, board/View.do detail links, no table
    _list("남해군", "공지사항",
          "https://www.namhae.go.kr/socialm/board/List.do?gcode=1131&pageCd=SM010101000&siteGubun=socialm",
          require="board/View.do"),
    # 남해군 고시공고 — modules/saeol/gosi, amode=_view detail links, no table
    _list("남해군", "고시공고",
          "https://www.namhae.go.kr/modules/saeol/gosi.do?pageCd=SM010110000&siteGubun=socialm",
          require="amode=_view"),
    # 경남도청 공지사항/고시공고 (gn.go.kr) — old TLS → ssl_get
    _ssl_entry("경남도청", "공지사항",
               "https://www.gn.go.kr/www/selectBbsNttList.do?bbsNo=12&key=258",
               require="selectBbsNttView"),
    _ssl_entry("경남도청", "고시공고",
               "https://www.gn.go.kr/www/selectGosiNttList.do?key=263&searchGosiSe=01,04,06",
               require="selectGosiNttView"),
]
