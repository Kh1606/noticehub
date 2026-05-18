"""
강원도 — batch of sites.

Skipped (JS / SSL error / timeout / NO TABLES):
  춘천시×2 (NO TABLES),
  화천군 고시 (contents.do NO TABLES),
  정선군 고시 (NO TABLES — JS-rendered), 양구군×2 added below,
  강릉시×2 (SSL handshake failure), 고성군×2 (SSL error),
  속초시×2 (SSL error), 동해시×2 (SSL error), 삼척시×2 (.web NO TABLES),
  양양군 고시공고 (no table), 정선군 고시 (no table)

양양군 공지사항 — pf_readForm('id') onclick → detail: ?articleSeq={id}
강원특별자치도 알림마당/도로사업소 — goPage(id) onclick → detail: ?articleSeq={id}

molit 강릉/정선/홍천 국토관리사무소 — LST.jsp boards (molit_jsp helper).
평창군 고시 — portal CMS, noticeMgrNo param in detail hrefs, title col 1.
"""
import re

from scrapers.base import SourceMeta, get, soup as mk_soup, Notice, parse_date, clean
from scrapers._helpers.simple_table import make_scrape, make_ssl_scrape
from scrapers._helpers.molit_jsp import scrape_molit_jsp
from scrapers._helpers.saeol import make_go_page2_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="강원도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _ssl_entry(sub, page, url, **opts):
    src = SourceMeta(region="강원도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_ssl_scrape(src, **opts)


def _molit(sub, page, url):
    src = SourceMeta(region="강원도", sub_entity=sub, source_page=page, source_url=url)
    return src, (lambda s=src: scrape_molit_jsp(s))


def _page2(sub, page, url):
    src = SourceMeta(region="강원도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_go_page2_scrape(src)


def _onclick_seq(sub, page, url, onclick_re: str):
    """Generic: extract ID from onclick using onclick_re, detail URL = url?articleSeq={id}."""
    src = SourceMeta(region="강원도", sub_entity=sub, source_page=page, source_url=url)
    _re = re.compile(onclick_re)
    base = url.split("?")[0]

    def _scrape():
        r = get(src.source_url)
        bs = mk_soup(r.text)
        t = max(bs.find_all("table"), key=lambda x: len(x.find_all("tr")), default=None)
        if not t:
            return []
        notices: list[Notice] = []
        for row in t.find_all("tr")[1:]:
            tds = row.find_all("td")
            if not tds:
                continue
            a = None
            for candidate in row.find_all("a"):
                if _re.search(candidate.get("onclick") or ""):
                    a = candidate
                    break
            if not a:
                continue
            m = _re.search(a.get("onclick") or "")
            if not m:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            detail_url = f"{base}?articleSeq={m.group(1)}"
            posted_at = None
            for td in reversed(tds):
                d = parse_date(td.get_text(strip=True))
                if d:
                    posted_at = d
                    break
            notices.append(Notice(
                region=src.region, sub_entity=src.sub_entity,
                source_page=src.source_page, source_url=src.source_url,
                detail_url=detail_url, title=title, posted_at=posted_at,
            ))
        return notices

    return src, _scrape


SCRAPERS = [
    # 원주시 — selectBbsNttList CMS; 공지 col 1, 고시 col 2
    _entry("원주시", "공지사항",
           "https://www.wonju.go.kr/www/selectBbsNttList.do?bbsNo=1&key=211&",
           require="selectBbsNttView"),
    _entry("원주시", "고시공고",
           "https://www.wonju.go.kr/www/selectBbsNttList.do?bbsNo=140&key=216&",
           title_col=2, require="selectBbsNttView"),
    # 홍천군 공지 — selectBbsNttList CMS, title col 1
    _entry("홍천군", "공지사항",
           "https://www.hongcheon.go.kr/www/selectBbsNttList.do?key=255&bbsNo=1",
           require="selectBbsNttView"),
    # 홍천군 고시 — selectEminwonList CMS, title col 2 (번호|고시번호|제목|담당|날짜)
    _entry("홍천군", "고시공고",
           "https://www.hongcheon.go.kr/www/selectEminwonList.do?key=278",
           title_col=2, require="selectEminwonView"),
    # 횡성군 공지 — selectBbsNttList CMS, title col 1
    _entry("횡성군", "공지사항",
           "https://www.hsg.go.kr/www/selectBbsNttList.do?bbsNo=59&key=812&",
           require="selectBbsNttView"),
    # 횡성군 고시 — same CMS (jsessionid in href), title col 1
    _entry("횡성군", "고시공고",
           "https://www.hsg.go.kr/www/selectBbsNttList.do?bbsNo=65&key=821&",
           require="selectBbsNttView"),
    # 영월군 — selectBbsNttList CMS; 공지 col 1, 고시 col 1 (고시번호 not separate)
    _entry("영월군", "공지사항",
           "https://www.yw.go.kr/www/selectBbsNttList.do?bbsNo=15&key=25",
           require="selectBbsNttView"),
    _entry("영월군", "고시공고",
           "https://www.yw.go.kr/www/selectBbsNttList.do?bbsNo=17&key=273",
           require="selectBbsNttView"),
    # 철원군 공지 — selectBbsNttList CMS (CWG_JSESSIONID in href), title col 1
    _entry("철원군", "공지사항",
           "https://www.cwg.go.kr/www/selectBbsNttList.do?bbsNo=24&key=206",
           require="selectBbsNttView"),
    # 철원군 고시 — same CMS, title col 1
    _entry("철원군", "고시공고",
           "https://www.cwg.go.kr/www/selectBbsNttList.do?bbsNo=25&key=1226",
           require="selectBbsNttView"),
    # 화천군 공지 — selectBbsNttList CMS, title col 1
    _entry("화천군", "공지사항",
           "https://www.ihc.go.kr/www/selectBbsNttList.do?bbsNo=11&key=2338",
           require="selectBbsNttView"),
    # 인제군 — portal/adm CMS, articleSeq detail links, title col 1
    _entry("인제군", "공지사항",
           "https://www.inje.go.kr/portal/adm/notice",
           require="articleSeq"),
    _entry("인제군", "고시공고",
           "https://www.inje.go.kr/portal/adm/bulletin/notify",
           require="articleSeq"),
    # 평창군 — portal CMS; 공지 articleSeq, 고시 noticeMgrNo
    _entry("평창군", "공지사항",
           "https://www.pc.go.kr/portal/government/government-news",
           require="articleSeq"),
    _entry("평창군", "고시공고",
           "https://www.pc.go.kr/portal/government/government-notification",
           require="noticeMgrNo"),
    # 태백시 — selectBbsNttList CMS, title col 1
    _entry("태백시", "공지사항",
           "https://www.taebaek.go.kr/www/selectBbsNttList.do?bbsNo=24&key=351",
           require="selectBbsNttView"),
    _entry("태백시", "고시공고",
           "https://www.taebaek.go.kr/www/selectBbsNttList.do?bbsNo=25&key=352",
           require="selectBbsNttView"),
    # 동해시 — selectBbsNttList, old TLS → ssl_get
    _ssl_entry("동해시", "공지사항",
               "https://www.dh.go.kr/www/selectBbsNttList.do?bbsNo=172&key=474",
               require="selectBbsNttView", title_col=2),
    _ssl_entry("동해시", "고시공고",
               "https://www.dh.go.kr/www/selectBbsNttList.do?bbsNo=87&key=478",
               require="selectBbsNttView"),
    # 양구군 — user_sub CMS; detail URLs contain &bk=, title col 1
    _entry("양구군", "공지사항",
           "https://www.yanggu.go.kr/user_sub?gfnc=www&mu_idx=225",
           require="&bk="),
    _entry("양구군", "고시공고",
           "https://www.yanggu.go.kr/user_sub?gfnc=www&mu_idx=226",
           require="&bk="),
    # 정선군 공지사항 — goPage2('SEQ') href; detail: list_url?articleSeq=SEQ
    _page2("정선군", "공지사항",
           "https://www.jeongseon.go.kr/portal/openadmin/adminnews/notice"),
    # molit 국토관리사무소 boards (LST.jsp)
    _molit("강릉 국토관리사무소", "공지사항",
           "http://www.molit.go.kr/wrocm/USR/BORD0201/m_20081/LST.jsp"),
    _molit("정선 국토관리사무소", "공지사항",
           "http://www.molit.go.kr/wrocm/USR/BORD0201/m_20143/LST.jsp"),
    _molit("홍천 국토관리사무소", "공지사항",
           "http://www.molit.go.kr/wrocm/USR/BORD0201/m_19978/LST.jsp"),
    # 원주지방국토관리청 고시공고 — BRD.jsp; col layout num|고시구분|제목|날짜|담당|조회 → title_col=2
    _entry("원주지방국토관리청", "고시공고",
           "https://www.molit.go.kr/wrocm/USR/BORD0201/m_15959/BRD.jsp",
           title_col=2, require="DTL"),
    # 양양군 공지사항 — pf_readForm('id') onclick; detail: ?articleSeq={id}
    _onclick_seq("양양군", "공지사항",
                 "https://www.yangyang.go.kr/gw/portal/yyc_news_notice",
                 r"pf_readForm\('(\d+)'\)"),
    # 강원특별자치도 알림마당 — goPage(id) onclick; detail: ?articleSeq={id}
    _onclick_seq("강원특별자치도", "알림마당",
                 "https://state.gwd.go.kr/portal/bulletin/notification",
                 r"goPage\((\d+)\)"),
    # 강원특별자치도 도로사업소 — same goPage pattern
    _onclick_seq("강원특별자치도 도로건설사업소", "공고",
                 "https://state.gwd.go.kr/road/announce",
                 r"goPage\((\d+)\)"),
]
