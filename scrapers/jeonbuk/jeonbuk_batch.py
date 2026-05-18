"""
전라북도 — batch of sites.

Skipped:
  전북개발공사 (SSL error)
  전북지방환경청 me.go.kr (blocked)
  남원시 공지 (404 or JS onclick)
  무주군 고시 (index.9is is a portal menu page with no article links)
  진안군 공지/고시, 장수군 공지/고시, 고창군 공지/고시 → jeonbuk_list_batch.py
  김제시 공지 (non-table list layout)
  군산시 고시공고, eminwon.*.go.kr OfrAction.do (JS or SSL)
  전북도청 고시/공고 (JS index.jeonbuk)

molit 국토관리사무소 boards use scrape_molit_jsp helper (LST.jsp, auto-detects date col).
"""
from scrapers.base import SourceMeta
from scrapers._helpers.simple_table import make_scrape
from scrapers._helpers.simple_list import make_list_scrape, make_ssl_list_scrape
from scrapers._helpers.molit_jsp import scrape_molit_jsp


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="전라북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _lentry(sub, page, url, **opts):
    src = SourceMeta(region="전라북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_list_scrape(src, **opts)


def _molit(sub, page, url):
    src = SourceMeta(region="전라북도", sub_entity=sub, source_page=page, source_url=url)
    return src, (lambda s=src: scrape_molit_jsp(s))


def _ssl_lentry(sub, page, url, **opts):
    src = SourceMeta(region="전라북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_ssl_list_scrape(src, **opts)


SCRAPERS = [
    # 전북개발공사 — list in <ul>/<li>, old TLS; eGovFrame mode=view&nttId detail links
    _ssl_lentry("전북개발공사", "공지사항",
                "https://www.jbdc.co.kr/notice/notice.do",
                require="mode=view&nttId="),
    # 전북도청 공지사항 — board/list.jeonbuk (BBS_0000012), title col 1
    _entry("전북도청", "공지사항",
           "https://www.jeonbuk.go.kr/board/list.jeonbuk?boardId=BBS_0000012&menuCd=DOM_000000103001002001&contentsSid=841&cpath=",
           require="view.jeonbuk"),
    # 전북도청 전북소식 — board/list.jeonbuk (BBS_0000005), title col 1
    _entry("전북도청", "전북소식",
           "https://www.jeonbuk.go.kr/board/list.jeonbuk?boardId=BBS_0000005&menuCd=DOM_000000102001001000&contentsSid=76&cpath=",
           require="view.jeonbuk"),
    # 새만금개발공사 — board.es ESMS, title col 1
    _entry("새만금개발공사", "고시 공고",
           "https://www.sdco.or.kr/board.es?mid=a10601020000&bid=0007",
           require="act=view"),
    # 전주시 새소식 — 9is CMS, title col 1
    _entry("전주시", "새소식",
           "https://www.jeonju.go.kr/planweb/board/list.9is?page=1&contentUid=ff8080818990c349018b041a87373953&boardUid=ff8080818990c349018b1dbaa78e4b41&subPath=",
           require="view.9is"),
    # 전주시 고시공고 — 9is CMS, extra 구분/고시번호 cols → title col 3
    _entry("전주시", "고시공고",
           "https://www.jeonju.go.kr/planweb/board/list.9is?contentUid=ff8080818990c349018b041a879f395a&boardUid=9be517a7914528ce01930aa3ddc26cf0&contentUid=ff8080818990c349018b041a879f395a&subPath=",
           title_col=3, require="view.9is"),
    # 군산시 공지사항 — custom CMS, title col 1; detail path contains m140/view
    _entry("군산시", "공지사항",
           "https://www.gunsan.go.kr/main/m140",
           require="m140/view"),
    # 정읍시 공지사항 — board/list.jeongeup, title col 1
    _entry("정읍시", "공지사항",
           "https://www.jeongeup.go.kr/board/list.jeongeup?boardId=BBS_0000012&menuCd=DOM_000000101001001000&contentsSid=5&cpath=",
           require="view.jeongeup"),
    # 임실군 공지사항 — board/list.imsil, title col 1
    _entry("임실군", "공지사항",
           "https://www.imsil.go.kr/board/list.imsil?boardId=BBS_0000002&menuCd=DOM_000000103001001000&contentsSid=161&cpath=",
           require="view.imsil"),
    # 임실군 고시공고 — list.imsil, no <table>; use simple_list
    _lentry("임실군", "고시공고",
            "https://www.imsil.go.kr/board/list.imsil?boardId=BBS_0000003&menuCd=DOM_000000103001005000&contentsSid=164&cpath=",
            require="view.imsil?boardId=BBS_0000003"),
    # 부안군 공지사항 — board/list.buan, title col 1
    _entry("부안군", "공지사항",
           "https://www.buan.go.kr/board/list.buan?boardId=BBS_0000053&menuCd=DOM_000000103001001000&contentsSid=687&cpath=",
           require="view.buan"),
    # 부안군 고시공고 — board/list.buan, title col 1
    _entry("부안군", "고시공고",
           "https://www.buan.go.kr/board/list.buan?boardId=BBS_0000054&menuCd=DOM_000000103001003000&contentsSid=84&cpath=",
           require="view.buan"),
    # 김제시 고시공고 — board/list.gimje, title col 1
    _entry("김제시", "고시공고",
           "https://www.gimje.go.kr/board/list.gimje?boardId=BBS_0000044&menuCd=DOM_000000104003000000&contentsSid=196&cpath=",
           require="view.gimje"),
    # 남원시 고시공고 — board/post/list.do, col 2 (번호|공고번호|제목)
    _entry("남원시", "고시공고",
           "https://www.namwon.go.kr/board/post/list.do?boardUid=ff8080818ea1fec5018ea24137680031&menuUid=ff8080818e3beff0018e4077131b007a&sort=registerDt,desc",
           title_col=2, require="post/view.do"),
    # 익산시 공지사항 — board/post/list.do, title col 1
    _entry("익산시", "공지사항",
           "https://www.iksan.go.kr/board/post/list.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa",
           require="post/view.do"),
    # 순창군 공지사항 — board/post/list.do, title col 1
    _entry("순창군", "공지사항",
           "https://www.sunchang.go.kr/board/post/list.do?boardUid=ff8080819a2f0e3b019a6c0c17ba1fd9&menuUid=ff8080819a2f0e3b019a5d1b0c40164a",
           require="post/view.do"),
    # 완주군 공지사항 — planweb/board/list.9is, title col 1
    _entry("완주군", "공지사항",
           "https://www.wanju.go.kr/planweb/board/list.9is?contentUid=ff8080818b024d8e018b274f3fdd2ae2&boardUid=ff8080818a49961a018ab011af3543bc&categoryUid2=ff8080818bc7fa7c018bd69c596z9039&contentUid=ff8080818b024d8e018b274f3fdd2ae2&subPath=",
           require="view.9is"),
    # 완주군 고시공고 — index.9is portal page has no <table>; use simple_list
    _lentry("완주군", "고시공고",
            "https://www.wanju.go.kr/index.9is?contentUid=ff8080818b024d8e018b274f41dd2af8",
            require="view.9is"),
    # 무주군 공지사항 — planweb/board/list.9is, title col 1
    _entry("무주군", "공지사항",
           "https://www.muju.go.kr/planweb/board/list.9is?contentUid=ff8080816c5f9d47016cbd3ae19f006b&boardUid=ff8080816d135a54016d1ecde9d8001a&categoryUid1=ff8080816d135a54016d1f57e4fa00fd",
           require="view.9is"),
    # molit 국토관리사무소 boards
    # 익산지방국토관리청 고시공고 — BRD.jsp; col num|고시구분|제목|날짜|담당|조회 → title_col=2
    _entry("익산지방국토관리청", "고시공고",
           "https://www.molit.go.kr/irocm/USR/BORD0201/m_15643/BRD.jsp",
           title_col=2, require="DTL"),
    _molit("광주 국토관리사무소", "공지사항",
           "http://www.molit.go.kr/irocm/USR/BORD0201/m_19663/LST.jsp"),
    _molit("남원 국토관리사무소", "공지사항",
           "http://www.molit.go.kr/irocm/USR/BORD0201/m_19785/LST.jsp"),
    _molit("순천 국토관리사무소", "공지사항",
           "http://www.molit.go.kr/irocm/USR/BORD0201/m_19814/LST.jsp"),
    _molit("전주 국토관리사무소", "공지사항",
           "http://www.molit.go.kr/irocm/USR/BORD0201/m_19805/LST.jsp"),
]
