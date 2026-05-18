"""
전라남도 — batch of sites using the simple_table helper.

Skipped:
  전남개발공사 (empty response)
  영산강유역환경청 me.go.kr (blocked)
  담양군 (JS-rendered / no links)
  고흥군 (no table / JS-rendered)

곡성군/구례군 고시공고 — GosiList.do board with searchDetail(id) onclick
  → GosiView.do?menuNo={menuNo}&not_ancmt_mgt_no={id}

해남군 고시공고 — 9is CMS with goDetialView onclick
  → GET index.9is?contentUid={detail_uid}&notmgtNo={id}&nowPageNum=1

영암군/신안군 고시공고 — col layout: 번호 | 고시유형 | 제목(with show/ link) | 담당 | 날짜 | 조회 → title_col=2
함평군 고시공고 — GosiList.do no-table board; GosiDetail.do?SEQ={id} links → simple_list

Col layout note:
  Most custom CMS boards: 번호 | 제목 | 담당 | 날짜 | 조회 → col=1
  고시공고 boards often add 고시번호 column: 번호 | 고시번호 | 제목 | ... → col=2
"""
import re
from urllib.parse import urljoin, urlparse, parse_qs

from scrapers.base import SourceMeta, get, soup as mk_soup, Notice, parse_date, clean
from scrapers._helpers.simple_table import make_scrape
from scrapers._helpers.simple_list import make_list_scrape


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="전라남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_scrape(src, **opts)


def _list(sub, page, url, **opts):
    src = SourceMeta(region="전라남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_list_scrape(src, **opts)


def _searchdetail_gosi(sub, page, list_url, detail_uid_path="GosiView.do"):
    """GosiList.do boards with searchDetail('id') onclick → GosiView.do detail."""
    src = SourceMeta(region="전라남도", sub_entity=sub, source_page=page, source_url=list_url)
    menu_no = parse_qs(urlparse(list_url).query).get("menuNo", [""])[0]
    base = urljoin(list_url, detail_uid_path)

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
            a = None
            for candidate in row.find_all("a"):
                combined = (candidate.get("href") or "") + (candidate.get("onclick") or "")
                if re.search(r"searchDetail\(", combined):
                    a = candidate
                    break
            if not a:
                continue
            m = re.search(r"searchDetail\('(\d+)'\)", (a.get("href") or "") + (a.get("onclick") or ""))
            if not m:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            detail_url = f"{base}?menuNo={menu_no}&not_ancmt_mgt_no={m.group(1)}"
            posted_at = parse_date(tds[4].get_text()) if len(tds) > 4 else None
            notices.append(Notice(
                region=src.region, sub_entity=src.sub_entity,
                source_page=src.source_page, source_url=src.source_url,
                detail_url=detail_url, title=title, posted_at=posted_at,
            ))
        return notices

    return src, _scrape


_HAENAM_GOSI_DETAIL_UID = "18e3368f7913117f01791bdc63505ada"


def _haenam_gosi():
    """해남군 고시공고 — 9is CMS goDetialView onclick, detail via GET with notmgtNo."""
    src = SourceMeta(
        region="전라남도", sub_entity="해남군", source_page="고시공고",
        source_url="https://www.haenam.go.kr/index.9is?contentUid=18e3368f7913117f017915ea3b971122",
    )

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
            if len(tds) < 2:
                continue
            a = tds[1].find("a", onclick=True) if len(tds) > 1 else None
            if not a:
                for td in tds:
                    a = td.find("a", onclick=True)
                    if a:
                        break
            if not a:
                continue
            m = re.search(r"goDetialView\('(\d+)'", a.get("onclick", ""))
            if not m:
                continue
            title = clean(a.get_text())
            if not title:
                continue
            detail_url = (
                f"https://www.haenam.go.kr/index.9is"
                f"?contentUid={_HAENAM_GOSI_DETAIL_UID}"
                f"&recordCountPerPage=10&notmgtNo={m.group(1)}&nowPageNum=1"
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
    # 목포시 공지사항 — custom CMS, mode=view detail links, title col 1
    _entry("목포시", "공지사항",
           "https://www.mokpo.go.kr/www/mokpo_news/notice",
           require="mode=view"),
    # 목포시 고시공고 — same CMS, title col 1
    _entry("목포시", "고시공고",
           "https://www.mokpo.go.kr/www/mokpo_news/notification/public_notice",
           require="mode=view"),
    # 전남도청 공지사항 + 도로교통과 — boardView.do detail links, title col 1
    _entry("전남도청", "공지사항",
           "https://www.jeonnam.go.kr/J0203/boardList.do?menuId=jeonnam0203000000",
           require="boardView.do"),
    _entry("전남도청 도로교통과", "자료실",
           "https://www.jeonnam.go.kr/T8409/boardList.do?menuId=jeonnam0915020300",
           require="boardView.do"),
    # 여수시 — custom CMS, mode=view detail links
    _entry("여수시", "공지사항",
           "https://www.yeosu.go.kr/www/govt/news/notice",
           require="mode=view"),
    _entry("여수시", "고시공고",
           "https://www.yeosu.go.kr/www/govt/news/notify",
           title_col=2, require="mode=view"),
    # 순천시 — custom CMS, mode=view detail links
    _entry("순천시", "공지사항",
           "https://www.suncheon.go.kr/kr/news/0001/0001/",
           require="mode=view"),
    _entry("순천시", "고시공고",
           "http://www.suncheon.go.kr/kr/news/0004/0005/0001/",
           title_col=2, require="mode=view"),
    # 나주시 — custom CMS, mode=view
    _entry("나주시", "공지사항",
           "https://www.naju.go.kr/www/administration/new/notify",
           require="mode=view"),
    # 나주시 고시공고 — same CMS, col 2 (번호|고시공고번호|제목)
    _entry("나주시", "고시공고",
           "https://www.naju.go.kr/www/administration/notice/gosi_new",
           title_col=2, require="mode=view"),
    # 광양시 공지사항 — board.es ESMS, act=view detail links, title col 1
    _entry("광양시", "공지사항",
           "https://gwangyang.go.kr/board.es?mid=a11001000000&bid=0001",
           require="act=view"),
    # 광양시 고시공고 — saeol gosi.es, col 2 (번호|공고번호|제목)
    _entry("광양시", "고시공고",
           "https://gwangyang.go.kr/saeol/gosi.es?mid=a11005020000&type_code=02,04",
           title_col=2, require="act=view"),
    # 곡성군 공지사항 — eGovFrame board/view.do, title col 1
    _entry("곡성군", "공지사항",
           "https://www.gokseong.go.kr/kr/board/list.do?bbsId=BBS_000000000000150&menuNo=102001001000",
           require="view.do"),
    # 곡성군 고시공고 — GosiList searchDetail onclick → GosiView.do
    _searchdetail_gosi("곡성군", "고시공고",
                       "https://www.gokseong.go.kr/board/GosiList.do?menuNo=102001003000"),
    # 구례군 공지사항 — eGovFrame board/view.do, title col 1
    _entry("구례군", "공지사항",
           "https://www.gurye.go.kr/board/list.do?bbsId=BBS_0000000000000056&menuNo=115004001000",
           require="view.do"),
    # 구례군 고시공고 — GosiList searchDetail onclick → GosiView.do
    _searchdetail_gosi("구례군", "고시공고",
                       "https://www.gurye.go.kr/board/GosiList.do?menuNo=115004002001"),
    # 보성군 — custom CMS, mode=view, title col 1
    _entry("보성군", "공지사항",
           "https://www.boseong.go.kr/www/open_administration/city_news/notice",
           require="mode=view"),
    _entry("보성군", "고시공고",
           "https://www.boseong.go.kr/www/open_administration/city_news/notification",
           require="mode=view"),
    # 화순군 — board.do ESMS variant, act=view, title col 1
    _entry("화순군", "공지사항",
           "https://www.hwasun.go.kr/board.do?S=S01&M=020102000000&b_code=0000000002",
           require="act=view"),
    # 장흥군 — custom CMS, mode=view
    _entry("장흥군", "공지사항",
           "https://www.jangheung.go.kr/www/organization/news/notice",
           require="mode=view"),
    _entry("장흥군", "고시공고",
           "https://www.jangheung.go.kr/www/organization/news/notification",
           title_col=2, require="mode=view"),
    # 강진군 — custom CMS, mode=view
    _entry("강진군", "공지사항",
           "https://www.gangjin.go.kr/www/government/news/notice",
           require="mode=view"),
    # 강진군 고시공고 — same CMS, title col 1 (번호|제목)
    _entry("강진군", "고시공고",
           "https://www.gangjin.go.kr/www/government/notice/gosi",
           require="mode=view"),
    # 해남군 공지사항 — 9is CMS, title col 1
    _entry("해남군", "공지사항",
           "https://www.haenam.go.kr/planweb/board/list.9is?contentUid=18e3368f5d745106015de95ebe732057&boardUid=18e3368f5fb80fdc015fdc42b7e003e0",
           require="view.9is"),
    # 해남군 고시공고 — 9is CMS goDetialView onclick → GET with notmgtNo
    _haenam_gosi(),
    # 영암군 공지사항 — custom CMS, show/ detail paths, title col 1
    _entry("영암군", "공지사항",
           "https://www.yeongam.go.kr/home/www/open_information/yeongam_news/notice",
           require="show/"),
    # 무안군 — custom CMS, mode=view, title col 1
    _entry("무안군", "공지사항",
           "https://www.muan.go.kr/www/openmuan/new/notice",
           require="mode=view"),
    _entry("무안군", "고시공고",
           "https://www.muan.go.kr/www/openmuan/new/announcement",
           require="mode=view"),
    # 영광군 — custom BBS, type=view detail links
    _entry("영광군", "공지사항",
           "https://www.yeonggwang.go.kr/bbs/?b_id=news_notice&site=headquarter_new&mn=9054",
           require="type=view"),
    _entry("영광군", "고시공고",
           "https://www.yeonggwang.go.kr/bbs/?b_id=gosigonggo&site=headquarter_new&mn=9059",
           title_col=2, require="type=view"),
    # 장성군 — custom CMS, show/ detail paths
    _entry("장성군", "공지사항",
           "https://www.jangseong.go.kr/home/www/news/jangseong/notice",
           require="show/"),
    _entry("장성군", "고시공고",
           "https://www.jangseong.go.kr/home/www/news/jangseong/announcement",
           title_col=2, require="show/"),
    # 진도군 — custom CS board
    _entry("진도군", "공지사항",
           "https://www.jindo.go.kr/home/board/B0052.cs?m=23",
           title_col=2, require="act=read"),
    _entry("진도군", "고시공고",
           "https://www.jindo.go.kr/home/gosi/general.cs?m=24",
           title_col=2, require="act=view"),
    # 완도군 — custom .cs board; nttId= distinguishes detail from list/page links
    _entry("완도군", "공지사항",
           "https://www.wando.go.kr/wando/sub.cs?m=298",
           require="nttId="),
    # 완도군 고시공고 — same site, col 2 (번호|고시공고번호|제목)
    _entry("완도군", "고시공고",
           "https://www.wando.go.kr/wando/sub.cs?m=318",
           title_col=2, require="nttId="),
    # 신안군 공지사항 — custom CMS, show/ detail paths, title col 1
    _entry("신안군", "공지사항",
           "https://www.shinan.go.kr/home/www/openinfo/participation_07/participation_07_02",
           require="show/"),
    # 신안군 고시공고 — same CMS; col 2 (번호|고시유형|제목|담당|날짜|조회)
    _entry("신안군", "고시공고",
           "https://www.shinan.go.kr/home/www/openinfo/participation_07/participation_07_04/page.wscms",
           title_col=2, require="show/"),
    # 영암군 고시공고 — same show/ CMS; col 2 (번호|고시유형|제목|담당|날짜|조회)
    _entry("영암군", "고시공고",
           "https://www.yeongam.go.kr/home/www/open_information/yeongam_news/announcement/yeongam.go",
           title_col=2, require="show/"),
    # 함평군 고시공고 — GosiList.do no-table board; links are GosiDetail.do?SEQ={id}
    _list("함평군", "고시공고",
          "https://www.hampyeong.go.kr/pg/GosiList.do?pageId=www273",
          require="GosiDetail.do"),
]
