"""
경상북도 — batch of sites.

Skipped (JS-rendered / 404 / blocked):
  포항시×2, 김천시×2, 구미시×2, 영천시×2,
  문경시×2, 경산시×2, 청송군×2, 칠곡군×2, 봉화군×2, 울진군 고시
  (portal/saeol JS, .web NO TABLES, board/list.tc 404)

경북도청 — eGovFrame board, title col 1; detail href contains BD_CODE=gosi_notice
안동시 공지 — portal/bbs/list.do, direct view links, title col 1
안동시 고시 — portal/saeol/gosi/list.do, direct view links, title col 2
영양군, 영덕군 — custom CMS with mode= / mod=document detail paths
예천군 공지 — open.content CMS, ?i= detail links, title col 1
예천군 고시 — open.content CMS, ?id= detail links, title col 2
상주시 고시 — .tc CMS; fnDetail(mgtNo) onclick → GET /gosi/detail.tc?mgtNo={id}&mn=10297
"""
import re

from scrapers.base import SourceMeta, get, soup as mk_soup, Notice, parse_date, clean
from scrapers._helpers.simple_table import make_scrape
from scrapers._helpers.saeol import make_saeol_scrape, make_portal_bbs_scrape, make_portal_board_scrape, make_fn_article_link_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="경상북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _saeol(sub, page, url):
    src = SourceMeta(region="경상북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_saeol_scrape(src)


def _bbs(sub, page, url):
    src = SourceMeta(region="경상북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_portal_bbs_scrape(src)


def _board(sub, page, url):
    src = SourceMeta(region="경상북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_portal_board_scrape(src)


def _fn_art(sub, page, url):
    src = SourceMeta(region="경상북도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_fn_article_link_scrape(src)


def _sangju_tc(page_name, source_url, onclick_re, detail_fn, date_col=4):
    """Generic scraper for .tc CMS boards (sangju.go.kr); extracts onclick IDs."""
    src = SourceMeta(region="경상북도", sub_entity="상주시", source_page=page_name,
                     source_url=source_url)

    def _scrape():
        r = get(src.source_url)
        bs = mk_soup(r.text)
        tables = bs.find_all("table")
        if not tables:
            return []
        t = max(tables, key=lambda x: len(x.find_all("tr")))
        notices: list[Notice] = []
        for row in t.find_all("tr")[1:]:
            tds = row.find_all("td")
            if len(tds) < 3:
                continue
            a = row.find("a", onclick=True)
            if not a:
                continue
            m = re.search(onclick_re, a.get("onclick", ""))
            if not m:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            posted_at = parse_date(tds[date_col].get_text()) if len(tds) > date_col else None
            notices.append(Notice(
                region=src.region, sub_entity=src.sub_entity,
                source_page=src.source_page, source_url=src.source_url,
                detail_url=detail_fn(m.group(1)), title=title, posted_at=posted_at,
            ))
        return notices

    return src, _scrape


def _sangju_gosi():
    return _sangju_tc(
        "고시공고",
        "https://www.sangju.go.kr/page/10297/10606.tc",
        onclick_re=r"fnDetail\('(\d+)'\)",
        detail_fn=lambda id: f"https://www.sangju.go.kr/gosi/detail.tc?mgtNo={id}&mn=10297",
    )


def _sangju_notice():
    _DETAIL = (
        "https://www.sangju.go.kr/life/page/10450/10202.tc"
        "?pageDtlOrdrNo=1&pageIndex=&boardNo={}&boardMngNo=7"
        "&searchCondition=1&searchKeyword=&recordCountPerPage=10"
        "&importUrl=%2Fboard%2Fview.tc"
    )
    return _sangju_tc(
        "공지사항",
        "https://www.sangju.go.kr/life/page/10450/10202.tc",
        onclick_re=r"boardList\.view\('(\d+)'\)",
        detail_fn=lambda id: _DETAIL.format(id),
        date_col=5,
    )


SCRAPERS = [
    # ── saeol portal 고시공고 ──────────────────────────────────────────────
    _saeol("포항시", "고시공고",
           "https://www.pohang.go.kr/portal/saeol/gosi/list.do?mid=0202010000"),
    _saeol("김천시", "고시공고",
           "https://www.gc.go.kr/portal/saeol/gosi/list.do?mId=1202180100"),
    _saeol("구미시", "고시공고",
           "https://www.gumi.go.kr/portal/saeol/gosi/list.do?seCode=01&mid=0401040000"),
    _saeol("영천시", "고시공고",
           "https://www.yc.go.kr/portal/saeol/gosi/list.do?mId=0301040000"),
    _saeol("문경시", "고시공고",
           "https://www.gbmg.go.kr/portal/saeol/gosi/list.do?mId=0301060000"),
    _saeol("청도군", "고시공고",
           "https://www.cheongdo.go.kr/portal/saeol/gosi/list.do?mid=0301020000"),
    _saeol("칠곡군", "고시공고",
           "https://www.chilgok.go.kr/portal/saeol/gosi/list.do?mId=0201030000"),
    _saeol("봉화군", "고시공고",
           "https://www.bonghwa.go.kr/portal/saeol/gosi/list.do?seCode=01&mid=0201030000"),
    # ── portal/bbs/list.do 공지사항 ───────────────────────────────────────
    _bbs("영천시", "공지사항",
         "https://www.yc.go.kr/portal/bbs/list.do?ptIdx=544&mId=0301010000"),
    _bbs("김천시", "공지사항",
         "https://www.gc.go.kr/portal/bbs/list.do?ptIdx=1807&mId=1202100000"),
    _bbs("문경시", "공지사항",
         "https://www.gbmg.go.kr/portal/bbs/list.do?ptIdx=73&mId=0301010000"),
    _bbs("칠곡군", "공지사항",
         "https://www.chilgok.go.kr/portal/bbs/list.do?ptIdx=111&mId=0201010000"),
    # ── portal/board/post/list.do 공지사항 ───────────────────────────────
    _board("포항시", "공지사항",
           "https://www.pohang.go.kr/portal/board/post/list.do?bcIdx=100&mid=0202010000"),
    _board("구미시", "공지사항",
           "https://www.gumi.go.kr/portal/board/post/list.do?bcIdx=1&mid=0401020000"),
    _board("청도군", "공지사항",
           "https://www.cheongdo.go.kr/portal/board/post/list.do?bcIdx=510&mid=0301010000"),
    _board("봉화군", "공지사항",
           "https://www.bonghwa.go.kr/portal/board/post/list.do?bcIdx=100&mid=0201010000"),
    # 경북도청 고시공고 — eGovFrame board, title col 1
    _entry("경북도청", "고시공고",
           "https://www.gb.go.kr/Main/page.do?mnu_uid=6789&&BD_CODE=gosi_notice",
           require="BD_CODE=gosi_notice"),
    # 경북 북부건설사업소 고시공고 — same domain, eGovFrame board, title col 1
    _entry("경북 북부건설사업소", "고시공고",
           "https://www.gb.go.kr/Main/gunsul/page.do?mnu_uid=15040&LARGE_CODE=980&MEDIUM_CODE=30&SMALL_CODE=10&mnu_order=3",
           require="BD_CODE=gunsul_notice_north"),
    # 안동시 — portal/bbs/list.do (공지) + portal/saeol/gosi (고시)
    _entry("안동시", "공지사항",
           "https://www.andong.go.kr/portal/bbs/list.do?ptIdx=156&mId=0401010000",
           require="portal/bbs/view.do"),
    _entry("안동시", "고시공고",
           "https://www.andong.go.kr/portal/saeol/gosi/list.do?mId=0401020100",
           title_col=2, require="portal/saeol/gosi/view.do"),
    # 영양군 — custom CMS, mode=view detail links, title col 1
    _entry("영양군", "공지사항",
           "https://www.yyg.go.kr/www/organization/yyg_news/notice",
           require="mode=view"),
    _entry("영양군", "고시공고",
           "https://www.yyg.go.kr/www/organization/yyg_news/notification",
           require="mode=view"),
    # 영덕군 — WordPress-style board, mod=document detail links, title col 1
    _entry("영덕군", "공지사항",
           "https://www.yd.go.kr/?page_id=752",
           require="mod=document"),
    _entry("영덕군", "고시공고",
           "https://www.yd.go.kr/?page_id=763",
           require="mod=document"),
    # 예천군 — open.content CMS: 공지 uses ?i= links (col 1), 고시 uses ?id= links (col 2)
    _entry("예천군", "공지사항",
           "https://www.ycg.kr/open.content/ko/administrative/news/notice/",
           require="./?i="),
    _entry("예천군", "고시공고",
           "https://www.ycg.kr/open.content/ko/administrative/news/announcement/",
           title_col=2, require="?id="),
    # 고령군 — fn_articleLink(BOARD_IDX) onclick; view URL embedded in page JS
    _fn_art("고령군", "공지사항",
            "https://www.goryeong.go.kr/kor/boardList.do?IDX=152&BRD_ID=1019"),
    _fn_art("고령군", "고시공고",
            "https://www.goryeong.go.kr/kor/boardList.do?IDX=154&BRD_ID=1023"),
    # 의성군 (usc.go.kr) — 공지 uses bod_uid=, 고시 uses not_ancmt_mgt_no=
    _entry("의성군", "공지사항",
           "https://www.usc.go.kr/ko/page.do?mnu_uid=156",
           require="bod_uid="),
    _entry("의성군", "고시공고",
           "https://www.usc.go.kr/ko/page.do?mnu_uid=157&boardType=notice",
           require="not_ancmt_mgt_no="),
    # 성주군 (sj.go.kr) — bod_uid= detail links; 고시 title col 2
    _entry("성주군", "공지사항",
           "https://sj.go.kr/page.do?mnu_uid=1024",
           title_col=2, require="bod_uid="),
    _entry("성주군", "고시공고",
           "https://sj.go.kr/page.do?mnu_uid=1044&",
           title_col=2, require="bod_uid="),
    # 경주시 — open_content CMS, parm_bod_uid= detail links, title col 1
    _entry("경주시", "공지사항",
           "https://www.gyeongju.go.kr/open_content/ko/page.do?mnu_uid=416&",
           require="parm_bod_uid="),
    _entry("경주시", "고시공고",
           "https://www.gyeongju.go.kr/open_content/ko/page.do?mnu_uid=423&",
           require="parm_bod_uid="),
    # 영주시 — open_content CMS; 공지 parm_bod_uid= col2, 고시 not_ancmt_mgt_no= col1
    _entry("영주시", "공지사항",
           "https://www.yeongju.go.kr/open_content/main/page.do?mnu_uid=1521",
           title_col=2, require="parm_bod_uid="),
    _entry("영주시", "고시공고",
           "https://www.yeongju.go.kr/open_content/main/page.do?mnu_uid=10619&boardType=notice",
           require="not_ancmt_mgt_no="),
    # 경북개발공사 — open_content CMS, parm_bod_uid= detail links, title col 1
    _entry("경북개발공사", "공지사항",
           "https://www.gbgs.go.kr/open_content/ko/page.do?mnu_uid=2159",
           require="parm_bod_uid="),
    _entry("경북개발공사", "고시공고",
           "https://www.gbgs.go.kr/open_content/ko/page.do?mnu_uid=2160&",
           require="parm_bod_uid="),
    # 군위군 (gunwi.go.kr) — 공지 bod_uid=, 고시 not_ancmt_mgt_no=
    _entry("군위군", "공지사항",
           "https://gunwi.go.kr/ko/page.do?mnu_uid=101&",
           require="bod_uid="),
    _entry("군위군", "고시공고",
           "https://gunwi.go.kr/ko/page.do?mnu_uid=666&boardType=notice",
           require="not_ancmt_mgt_no="),
    # 상주시 고시 — .tc CMS; fnDetail onclick → /gosi/detail.tc?mgtNo={id}&mn=10297
    _sangju_gosi(),
    # 상주시 공지사항 — same .tc CMS; boardList.view onclick → life/page detail URL
    _sangju_notice(),
]
