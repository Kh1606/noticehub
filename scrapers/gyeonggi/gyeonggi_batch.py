"""
경기도 — batch of sites using the simple_table helper.

Skipped (JS-rendered / SSL error / 404 / JS-onclick navigation):
  경기도청 (JS table, no anchors)
  성남시청, 용인시청 공법 (SSL errors)
  고양시청, 양주시, 의왕시 (JS/no links)
  용인시청 입찰 (JSP session-based)
  평택시청 (404)
  시흥시청, 의정부시청, 과천시, 광주시, 안성시, 오산시, 이천시 (saeol CMS — title anchors use req.post/boardView JS)

selectGosiList.do col layout: 번호 | 고시번호 | [날짜 or 분류] | 제목 | 담당 | 기간
selectGosiNttList.do col layout: 번호 | 고시번호 | 제목 | 담당 | 날짜
selectEminwonList.do col layout varies: col 1 (포천) or col 2 (군포)
광명시 BD_selectNftcBbsList layout: 번호 | 공시공고번호 | 공고명 | 담당부서 | 공고일 | 조회수
  → detail: BD_selectNftcBbsDetail.do?q_nttNo={id}&q_nftcBbsCode={code}
  → requires ssl_get (old TLS)
화성시 BD_notice.do: 고시공고번호 | 제목 | 담당부서 | 공고일자 | 공고기간
  → detail: BD_selectNoticeDetail.do?q_notAncmtMgtNo={id}
용인시 BD_selectBbsList.do: 번호 | 제목 | 첨부파일 | 등록일시 | 조회수
  → detail: BD_selectBbs.do?q_bbsCode=1156&q_bbscttSn={id}
  → requires ssl_get (old TLS)
"""
import re
from urllib.parse import urljoin, urlparse, parse_qs

from scrapers.base import SourceMeta, ssl_get, soup as mk_soup, Notice, parse_date, clean
from scrapers._helpers.simple_table import make_scrape, make_ssl_scrape
from scrapers._helpers.saeol import make_saeol_scrape, make_fn_go_detail_scrape, make_bd_board_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="경기도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _ssl_entry(sub, page, url, **opts):
    src = SourceMeta(region="경기도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_ssl_scrape(src, **opts)


def _saeol(sub, page, url):
    src = SourceMeta(region="경기도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_saeol_scrape(src)


def _go_detail(sub, page, url, **opts):
    src = SourceMeta(region="경기도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_fn_go_detail_scrape(src, **opts)


def _bd_board(sub, page, url, **opts):
    src = SourceMeta(region="경기도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_bd_board_scrape(src, **opts)


def _gwangmyeong_gosi():
    src = SourceMeta(
        region="경기도", sub_entity="광명시", source_page="공고 공시 입법예고",
        source_url=(
            "https://www.gm.go.kr/pt/user/nftcBbs/BD_selectNftcBbsList.do"
            "?q_nftcBbsCode=1001&q_nftcBbsMgtno=&q_searchKeyTy=&q_searchVal="
            "&q_rowPerPage=&q_currPage=1&q_sortName=&q_sortOrder="
        ),
    )

    def _scrape():
        r = ssl_get(src.source_url)
        bs = mk_soup(r.text)
        tables = bs.find_all("table")
        if not tables:
            return []
        t = max(tables, key=lambda x: len(x.find_all("tr")))
        bbs_code = parse_qs(urlparse(src.source_url).query).get("q_nftcBbsCode", [""])[0]
        notices: list[Notice] = []
        for row in t.find_all("tr")[1:]:
            tds = row.find_all("td")
            if len(tds) <= 2:
                continue
            a = tds[2].find("a", onclick=True)
            if not a:
                continue
            m = re.search(r"opDetail\('(\d+)'\)", a.get("onclick", ""))
            if not m:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            detail_url = urljoin(
                src.source_url,
                f"BD_selectNftcBbsDetail.do?q_nttNo={m.group(1)}&q_nftcBbsCode={bbs_code}",
            )
            posted_at = parse_date(tds[4].get_text()) if len(tds) > 4 else None
            notices.append(Notice(
                region=src.region, sub_entity=src.sub_entity,
                source_page=src.source_page, source_url=src.source_url,
                detail_url=detail_url, title=title, posted_at=posted_at,
            ))
        return notices

    return src, _scrape


def _hscity_gosi():
    src = SourceMeta(
        region="경기도", sub_entity="화성시", source_page="고시공고",
        source_url="https://www.hscity.go.kr/www/gosi/BD_notice.do",
    )

    def _scrape():
        r = ssl_get(src.source_url)
        bs = mk_soup(r.text)
        tables = bs.find_all("table")
        if not tables:
            return []
        t = max(tables, key=lambda x: len(x.find_all("tr")))
        notices: list[Notice] = []
        for row in t.find_all("tr")[1:]:
            tds = row.find_all("td")
            if len(tds) < 2:
                continue
            a = None
            for candidate in row.find_all("a"):
                if re.search(r"opGosiView\(", candidate.get("href") or ""):
                    a = candidate
                    break
            if not a:
                continue
            m = re.search(r"opGosiView\('(\d+)'\)", a.get("href") or "")
            if not m:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            detail_url = urljoin(
                src.source_url,
                f"BD_selectNoticeDetail.do?q_notAncmtMgtNo={m.group(1)}",
            )
            posted_at = parse_date(tds[3].get_text()) if len(tds) > 3 else None
            notices.append(Notice(
                region=src.region, sub_entity=src.sub_entity,
                source_page=src.source_page, source_url=src.source_url,
                detail_url=detail_url, title=title, posted_at=posted_at,
            ))
        return notices

    return src, _scrape


def _yongin_gosi():
    src = SourceMeta(
        region="경기도", sub_entity="용인시", source_page="고시공고",
        source_url="https://www.yongin.go.kr/user/bbs/BD_selectBbsList.do?q_bbsCode=1156",
    )

    def _scrape():
        r = ssl_get(src.source_url)
        bs = mk_soup(r.text)
        tables = bs.find_all("table")
        if not tables:
            return []
        t = max(tables, key=lambda x: len(x.find_all("tr")))
        notices: list[Notice] = []
        for row in t.find_all("tr")[1:]:
            tds = row.find_all("td")
            if len(tds) < 2:
                continue
            a = tds[1].find("a", href=True) if len(tds) > 1 else None
            if not a:
                continue
            href = a.get("href", "")
            if not href or "BD_selectBbs.do" not in href:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            detail_url = urljoin(src.source_url, href)
            posted_at = parse_date(tds[3].get_text()) if len(tds) > 3 else None
            notices.append(Notice(
                region=src.region, sub_entity=src.sub_entity,
                source_page=src.source_page, source_url=src.source_url,
                detail_url=detail_url, title=title, posted_at=posted_at,
            ))
        return notices

    return src, _scrape


SCRAPERS = [
    # ── saeol portal 고시공고 sites ────────────────────────────────────────
    _saeol("시흥시", "고시공고",
           "https://www.siheung.go.kr/main/saeol/gosi/list.do?mId=0401040100"),
    _saeol("의정부시", "고시공고",
           "https://www.ui4u.go.kr/portal/saeol/gosiList.do?seCode=01&mId=0301040000"),
    _saeol("평택시", "고시공고",
           "https://www.pyeongtaek.go.kr/pyeongtaek/saeol/gosi/list.do?seCode=01&mid=0401020100"),
    _saeol("과천시", "고시공고",
           "https://www.gccity.go.kr/portal/saeol/gosi/list.do?mId=0301040000"),
    _saeol("광주시", "고시공고",
           "https://www.gjcity.go.kr/portal/saeol/gosi/list.do?mId=0202010000"),
    _saeol("안성시", "고시공고",
           "https://www.anseong.go.kr/portal/saeol/gosiList.do?mId=0501040000"),
    _saeol("오산시", "고시공고",
           "https://www.osan.go.kr/portal/saeol/gosi/list.do?mId=0302010000"),
    _saeol("이천시", "고시공고",
           "https://www.icheon.go.kr/portal/saeol/gosi/list.do?seCode=04&mid=0402020000"),
    # 경기도시공사 — article board, col 1
    _entry("경기도시공사", "고시 공고",
           "https://www.gh.or.kr/gh/bid-announcement.do",
           require="mode=view"),
    # 남양주시 — selectEminwonWebList; col 1 (번호|고시번호+제목 combined)
    _entry("남양주시", "고시 공고",
           "https://www.nyj.go.kr/www/selectEminwonWebList.do?key=2492&sa1=01&sa1=02&sa1=04&sa1=05&sc4=2024",
           require="selectEminwonWebView"),
    # 수원시 — saeallOfr BD_ofrList; col 2 (번호|고시공고번호|제목)
    _entry("수원시", "공고 공시 입법예고",
           "https://www.suwon.go.kr/web/saeallOfr/BD_ofrList.do",
           title_col=2, require="BD_ofrView"),
    # 부천시청 — basicboard, col 1; encid= distinguishes detail from list
    _entry("부천시청", "기타공고",
           "https://www.bucheon.go.kr/site/program/board/basicboard/list?boardtypeid=26754&menuid=148002003002",
           require="encid="),
    # 가평군 — selectGosiList, col 3 (번호|고시번호|날짜|제목|담당|기간)
    _entry("가평군", "고시 공고",
           "https://www.gp.go.kr/portal/selectGosiList.do?key=2148&not_ancmt_se_code=01",
           title_col=3, require="selectGosiData"),
    # 구리시 — selectGosiNttList, col 2 (번호|고시번호|제목|담당|날짜)
    _entry("구리시", "고시 공고",
           "https://www.guri.go.kr/www/selectGosiNttList.do?key=387&searchGosiSe=01,04,06",
           title_col=2, require="selectGosiNttView"),
    # 군포시 — selectEminwonList, col 2
    _entry("군포시", "고시 공고",
           "http://www.gunpo.go.kr/www/selectEminwonList.do?key=3907&Not_ancmt_se_code=01,04&list_gubun=N&ofr_pageSize=10",
           title_col=2, require="selectEminwonView"),
    # 동두천시 — selectGosiList, col 2 (번호|고시번호|제목|담당|날짜)
    _entry("동두천시", "고시 공고",
           "https://www.ddc.go.kr/ddc/selectGosiList.do?key=340&not_ancmt_se_code=04",
           title_col=2, require="selectGosiData"),
    # 김포시 — ntfcPblancList, col 2 (번호|고시번호|제목|담당|날짜)
    _entry("김포시", "고시 공고",
           "https://www.gimpo.go.kr/portal/ntfcPblancList.do?key=1004&cate_cd=1&searchCnd=40900000000",
           title_col=2, require="ntfcPblancView"),
    # 양평군 — selectBbsNttList, col 1
    _entry("양평군", "고시 공고",
           "https://www.yp21.go.kr/www/selectBbsNttList.do?bbsNo=5&key=1119",
           require="selectBbsNttView"),
    # 여주시 — selectBbsNttList, col 3 (번호|고시번호|분류|제목|첨부|담당|날짜|조회)
    _entry("여주시", "공고 공시 입법예고",
           "https://www.yeoju.go.kr/www/selectBbsNttList.do?bbsNo=28&key=354",
           title_col=3, require="selectBbsNttView"),
    # 연천군 — selectGosiList, col 3 (번호|고시번호|날짜|제목|담당|기간)
    _entry("연천군", "고시 공고",
           "https://www.yeoncheon.go.kr/www/selectGosiList.do?key=3393&not_ancmt_se_code=01",
           title_col=3, require="selectGosiData"),
    # 포천시 — selectEminwonList, col 1 (번호|제목|담당|날짜)
    _entry("포천시", "고시 공고",
           "https://www.pocheon.go.kr/www/selectEminwonList.do?key=12563&notAncmtSeCode=01",
           require="selectEminwonView"),
    # 하남시 — selectGosiList, col 3 (번호|고시번호|날짜|제목|담당|기간)
    _entry("하남시", "고시 공고",
           "https://www.hanam.go.kr/www/selectGosiList.do?key=171&not_ancmt_se_code=01,03,04",
           title_col=3, require="selectGosiData"),
    # 안산시 — selectPageListBbs, fnGoDetail onclick, title col 2
    _go_detail("안산시", "고시 공고",
               "https://www.ansan.go.kr/www/common/bbs/selectPageListBbs.do?bbs_code=WWW13",
               title_col=2),
    # 안양시 — selectEminwonList, old TLS; title col 1 (번호|제목|담당|날짜)
    _ssl_entry("안양시", "고시공고",
               "https://www.anyang.go.kr/main/selectEminwonList.do?key=4101&notAncmtSeCode=01,04",
               require="selectEminwonView"),
    # 파주시 — BD_board OpenWorks, jsView onclick, title col 1
    _bd_board("파주시", "고시 공고",
              "https://www.paju.go.kr/user/board/BD_board.list.do?bbsCd=1022&q_ctgCd=4063"),
    # 광명시 — NftcBbs board, opDetail onclick; title col 2, date col 4; requires ssl_get
    _gwangmyeong_gosi(),
    # 화성시 — BD_notice.do with opGosiView onclick; detail: BD_selectNoticeDetail.do
    _hscity_gosi(),
    # 용인시 — BD_selectBbsList.do; href has detail URL; requires ssl_get
    _yongin_gosi(),
]
