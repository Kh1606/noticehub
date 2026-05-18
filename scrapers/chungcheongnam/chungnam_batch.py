"""
충청남도 — batch of sites using the simple_table helper.

Skipped (JS-rendered / no links / 404):
  금강유역환경청 (blocked)
  충남도청 종합건설사업소 ddc.go.kr (동두천시 domain — data error)
  서산시 고시공고 (contents.do JS / eminwon iframe)
  당진시 고시공고 (JS sub page / no links)
  논산시 고시공고 (no table)
  서천군 고시공고 (no table)
  태안군 고시공고, 청양군 고시공고 (no table)

공주시/홍성군/예산군 공지사항 — BBSMSTR boards use fn_search_detail onclick
  → scrape_bbsmstr_fn_detail helper; view URL = list.do base + /view.do?nttId=

충남개발공사 — table with goView(pstSn) onclick
  → detail: bbs/view.do?pstSn={id}&key={board_key}
"""
import re
from urllib.parse import urljoin, urlparse, parse_qs

from scrapers.base import SourceMeta, get, soup as mk_soup, Notice, parse_date, clean
from scrapers._helpers.simple_table import make_scrape
from scrapers._helpers.saeol import make_saeol_scrape, make_bbsmstr_fn_detail_scrape, make_popup_center_scrape


def _src(sub_entity, source_page, source_url):
    return SourceMeta(
        region="충청남도",
        sub_entity=sub_entity,
        source_page=source_page,
        source_url=source_url,
    )


def _entry(sub, page, url, **opts):
    src = _src(sub, page, url)
    return src, make_scrape(src, **opts)


def _saeol(sub, page, url):
    src = _src(sub, page, url)
    return src, make_saeol_scrape(src)


def _bbsmstr(sub, page, url):
    src = _src(sub, page, url)
    return src, make_bbsmstr_fn_detail_scrape(src)


def _popup(sub, page, url, **opts):
    src = _src(sub, page, url)
    return src, make_popup_center_scrape(src, **opts)


def _cndc_gosi():
    src = _src("충남개발공사", "공지사항", "https://www.cndc.kr/bbs/list.do?key=2404080002")

    def _scrape():
        r = get(src.source_url)
        bs = mk_soup(r.text)
        tables = bs.find_all("table")
        if not tables:
            return []
        t = max(tables, key=lambda x: len(x.find_all("tr")))
        board_key = parse_qs(urlparse(src.source_url).query).get("key", [""])[0]
        notices: list[Notice] = []
        for row in t.find_all("tr")[1:]:
            tds = row.find_all("td")
            if len(tds) < 2:
                continue
            a = tds[1].find("a", onclick=True)
            if not a:
                continue
            m = re.search(r"goView\('(\d+)'\)", a.get("onclick", ""))
            if not m:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            detail_url = urljoin(
                src.source_url,
                f"view.do?pstSn={m.group(1)}&key={board_key}",
            )
            posted_at = parse_date(tds[-1].get_text()) if tds else None
            notices.append(Notice(
                region=src.region, sub_entity=src.sub_entity,
                source_page=src.source_page, source_url=src.source_url,
                detail_url=detail_url, title=title, posted_at=posted_at,
            ))
        return notices

    return src, _scrape


SCRAPERS = [
    # ── saeolGosi portal 고시공고 ──────────────────────────────────────────
    _saeol("공주시", "고시공고",
           "https://www.gongju.go.kr/prog/saeolGosi/GOSI_01/sub04_03_01/list.do"),
    _saeol("홍성군", "고시공고",
           "https://www.hongseong.go.kr/prog/saeolGosi/kor/sub03_0204/GOSI_ALL/list.do"),
    _saeol("예산군", "고시공고",
           "https://www.yesan.go.kr/prog/saeolGosi/GOSI/kor/sub04_03_01/list.do"),
    # ── BBSMSTR fn_search_detail 공지사항 ────────────────────────────────────
    _bbsmstr("천안시", "공지사항",
             "https://www.cheonan.go.kr/bbs/BBSMSTR_000000000450/list.do"),
    _bbsmstr("공주시", "공지사항",
             "https://www.gongju.go.kr/bbs/BBSMSTR_000000000813/list.do"),
    _bbsmstr("홍성군", "공지사항",
             "https://www.hongseong.go.kr/prog/bbsArticle/BBSMSTR_000000000841/list.do"),
    _bbsmstr("예산군", "공지사항",
             "https://www.yesan.go.kr/bbs/BBSMSTR_000000000046/list.do"),
    # 충남도청 고시공고 — eGovFrame board, title col 1; view.do?nttId detail links
    _entry("충남도청", "고시공고",
           "https://www.chungnam.go.kr/cnportal/bbs/B0000488/list.do?menuNo=5100288",
           require="view.do?nttId"),
    # 충남도청 도로사업 — same eGovFrame board, title col 2 (분류|번호|제목|...)
    _entry("충남도청 도로사업", "도로관리",
           "https://www.chungnam.go.kr/cnportal/province/province/list.do?menuNo=500487",
           title_col=2, require="view.do?nttId"),
    # 천안시 고시공고 — saeol CMS, col 2 (번호|고시공고번호|제목); view.do?notAncmtMgtNo
    _entry("천안시", "고시공고",
           "https://www.cheonan.go.kr/prog/saeolGosi/GOSI/kor/sub02_02_01/list.do",
           title_col=2, require="view.do?notAncmtMgtNo"),
    # 금산군 공지사항 — custom HTML board, mode=V detail links, title col 1
    _entry("금산군", "공지사항",
           "https://www.geumsan.go.kr/kr/html/sub03/030101.html",
           require="mode=V"),
    # 금산군 고시공고 — same site, col 2 (번호|고시공고번호|제목)
    _entry("금산군", "고시공고",
           "https://www.geumsan.go.kr/kr/html/sub03/030302.html",
           title_col=2, require="mode=V"),
    # 부여군 고시공고 — same custom board as 공지사항, title col 1
    _entry("부여군", "고시공고",
           "https://www.buyeo.go.kr/_prog/_board/?code=news_02&site_dvs_cd=kr&menu_dvs_cd=040205",
           require="mode=V"),
    # 서산시 — eGovFrame selectBbsNttList, title col 1
    _entry("서산시", "공지사항",
           "https://www.seosan.go.kr/www/selectBbsNttList.do?bbsNo=97&key=1256",
           require="selectBbsNttView"),
    # 당진시 — eGovFrame selectBoardList, title col 1
    _entry("당진시", "공지사항",
           "https://www.dangjin.go.kr/cop/bbs/BBSMSTR_000000000013/selectBoardList.do",
           require="selectBoardArticle"),
    # 논산시 — custom CMS, mode=V detail links, title col 1
    _entry("논산시", "공지사항",
           "https://www.nonsan.go.kr/kor/html/sub03/030101.html",
           require="mode=V"),
    # 보령시 — eGovFrame selectBoardList, title col 1
    _entry("보령시", "공지사항",
           "https://www.brcn.go.kr/cop/bbs/BBSMSTR_000000000263/selectBoardList.do",
           require="selectBoardArticle"),
    # 부여군 — custom board, mode=V detail links, title col 1
    _entry("부여군", "공지사항",
           "https://www.buyeo.go.kr/_prog/_board/?code=news_01&site_dvs_cd=kr&menu_dvs_cd=0401",
           require="mode=V"),
    # 태안군 — eGovFrame selectBoardList, title col 1
    _entry("태안군", "공지사항",
           "https://www.taean.go.kr/cop/bbs/BBSMSTR_000000000036/selectBoardList.do",
           require="selectBoardArticle"),
    # 서천군 — eGovFrame selectBoardList, title col 1
    _entry("서천군", "공지사항",
           "https://www.seocheon.go.kr/cop/bbs/BBSMSTR_000000000056/selectBoardList.do",
           require="selectBoardArticle"),
    # 계룡시 공지사항 — custom CMS, mode=V, title col 1
    _entry("계룡시", "공지사항",
           "https://www.gyeryong.go.kr/kr/html/sub03/030101.html",
           require="mode=V"),
    # 계룡시 고시공고 — same CMS, title at col 2 (번호 / 고시번호 / 제목 ...)
    _entry("계룡시", "고시공고",
           "https://www.gyeryong.go.kr/kr/html/sub03/030102.html",
           title_col=2, require="mode=V"),
    # 청양군 — eGovFrame selectBoardList, title col 1
    _entry("청양군", "공지사항",
           "http://www.cheongyang.go.kr/cop/bbs/BBSMSTR_000000000037/selectBoardList.do",
           require="selectBoardArticle"),
    # 보령시 고시공고 — eminwon iframe table, popupCenter onclick, title col 1
    _popup("보령시", "고시공고",
           "https://www.brcn.go.kr/prog/eminwon/kor/BB/sub04_03_01/list.do"),
    # 충남개발공사 — table with goView(pstSn) onclick; detail: bbs/view.do?pstSn={id}&key={key}
    _cndc_gosi(),
]
