"""
충청북도 — batch of sites using the simple_table helper.

Skipped (JS-rendered / SSL error / no table):
  청주시 고시공고 + 4구 고시공고 (all contents.do JS / eminwon SSL error)
  영동군 (SSL cert error)
  진천군 고시공고 (no table)
  증평군 고시공고 (no table)
  단양군 고시공고 (no table)
"""
from scrapers.base import SourceMeta, get
from scrapers._helpers.simple_table import make_scrape, make_ssl_scrape, extract_from_html


def _src(sub_entity, source_page, source_url):
    return SourceMeta(
        region="충청북도",
        sub_entity=sub_entity,
        source_page=source_page,
        source_url=source_url,
    )


def _entry(sub, page, url, **opts):
    src = _src(sub, page, url)
    return src, make_scrape(src, **opts)


def _ssl_entry(sub, page, url, **opts):
    src = _src(sub, page, url)
    return src, make_ssl_scrape(src, **opts)


def _chungbuk_gosi_entry():
    # Source URL matches xlsx entry (contents.do); actual board is selectGosiPblancList.do
    src = _src("충북도청", "고시공고", "https://www.chungbuk.go.kr/www/contents.do?key=422")
    actual = "https://www.chungbuk.go.kr/www/selectGosiPblancList.do?key=422"

    def _scrape():
        r = get(actual)
        return extract_from_html(r.content, src, title_col=2, require="selectGosiPblancView")

    return src, _scrape


SCRAPERS = [
    # 충북도청 고시공고 — selectGosiPblancList hidden behind contents.do portal
    _chungbuk_gosi_entry(),
    # 영동군 — old TLS (yd21.go.kr); mode=V detail links, title col 1
    _ssl_entry("영동군", "공지사항",
               "https://www.yd21.go.kr/kr/html/sub02/020101.html",
               require="mode=V"),
    _ssl_entry("영동군", "고시공고",
               "https://www.yd21.go.kr/kr/html/sub02/020103.html",
               require="mode=V"),
    # 충북개발공사 — custom zboard, title col 1
    _entry("충북개발공사", "공지사항",
           "https://www.cbdc.co.kr/zboard/list.do?lmCode=BBSMSTR_000000000018",
           require="zboard/read"),
    # 충북도청 도로관리사업소 — eGovFrame selectBbsNttList, title col 1
    _entry("충북도청 도로관리사업소", "공지사항",
           "https://www.chungbuk.go.kr/road/selectBbsNttList.do?bbsNo=292&key=1975",
           require="selectBbsNttView"),
    # 청주시 — eGovFrame selectBbsNttList, title col 1
    _entry("청주시", "공지사항",
           "https://www.cheongju.go.kr/www/selectBbsNttList.do?bbsNo=510&key=280&integrDeptCode=000100101",
           require="selectBbsNttView"),
    # 청주시 4개 구청 — same eGovFrame pattern, title col 1
    _entry("청주시-상당구", "공지사항",
           "https://www.cheongju.go.kr/sangdang/selectBbsNttList.do?bbsNo=511&key=1018&integrDeptCode=000100186",
           require="selectBbsNttView"),
    _entry("청주시-서원구", "공지사항",
           "https://www.cheongju.go.kr/seowon/selectBbsNttList.do?bbsNo=513&key=1194&integrDeptCode=000100209",
           require="selectBbsNttView"),
    _entry("청주시-흥덕구", "공지사항",
           "https://www.cheongju.go.kr/heungdeok/selectBbsNttList.do?bbsNo=512&key=1889&integrDeptCode=000100230",
           require="selectBbsNttView"),
    _entry("청주시-청원구", "공지사항",
           "https://www.cheongju.go.kr/cheongwon/selectBbsNttList.do?bbsNo=514&key=1309&integrDeptCode=000100251",
           require="selectBbsNttView"),
    # 제천시 — eGovFrame, extra category col → title at col 2
    _entry("제천시", "공지사항",
           "https://www.jecheon.go.kr/www/selectBbsNttList.do?bbsNo=11&key=114",
           title_col=2, require="selectBbsNttView"),
    _entry("제천시", "고시공고",
           "https://www.jecheon.go.kr/www/selectBbsNttList.do?bbsNo=18&key=5233",
           require="selectBbsNttView"),
    # 충주시 — eGovFrame, extra col → title at col 2
    _entry("충주시", "공지사항",
           "https://www.chungju.go.kr/www/selectBbsNttList.do?key=506&bbsNo=5",
           title_col=2, require="selectBbsNttView"),
    # 충주시 고시공고 — selectEminwonList, title col 2
    _entry("충주시", "고시공고",
           "https://www.chungju.go.kr/www/selectEminwonList.do?key=510&ofr_pageSize=10&ancmt_se_code=01,02,04&pageIndex=1",
           title_col=2, require="selectEminwonView"),
    # 음성군 — eGovFrame, title col 1
    _entry("음성군", "공지사항",
           "https://www.eumseong.go.kr/www/selectBbsNttList.do?bbsNo=6&key=78",
           require="selectBbsNttView"),
    # 음성군 고시공고 — selectEminwonList, title col 1
    _entry("음성군", "고시공고",
           "https://www.eumseong.go.kr/www/selectEminwonList.do?key=80&pageUnit=10&ofr_pageSize=10&not_ancmt_se_code=01,02,03,04,05&pageIndex=1",
           require="selectEminwonView"),
    # 진천군 — custom CMS sub.do, title col 2
    _entry("진천군", "공지사항",
           "https://www.jincheon.go.kr/home/sub.do?menukey=2908",
           title_col=2, require="mode=view"),
    # 옥천군 — eGovFrame selectBbsNttList
    _entry("옥천군", "공지사항",
           "https://www.oc.go.kr/www/selectBbsNttList.do?bbsNo=36&key=232&",
           require="selectBbsNttView"),
    # 옥천군 고시공고 — same CMS, col 1 (공고번호|제목|담당)
    _entry("옥천군", "고시공고",
           "https://www.oc.go.kr/www/selectBbsNttList.do?bbsNo=40&key=236&",
           require="selectBbsNttView"),
    # 증평군 — eGovFrame selectBoardList, title col 2
    _entry("증평군", "공지사항",
           "https://www.jp.go.kr/kor/cop/bbs/BBSMSTR_000000000134/selectBoardList.do",
           title_col=2, require="selectBoardArticle"),
    # 괴산군 — eGovFrame selectBbsNttList, title col 1
    _entry("괴산군", "공지사항",
           "https://www.goesan.go.kr/www/selectBbsNttList.do?key=135&bbsNo=190",
           require="selectBbsNttView"),
    _entry("괴산군", "고시공고",
           "https://www.goesan.go.kr/www/selectBbsNttList.do?bbsNo=214&key=137",
           require="selectBbsNttView"),
    # 보은군 — eGovFrame selectBbsNttList, title col 1
    _entry("보은군", "공지사항",
           "https://www.boeun.go.kr/www/selectBbsNttList.do?bbsNo=4&key=134",
           require="selectBbsNttView"),
    # 보은군 고시공고 — same CMS, title col 1
    _entry("보은군", "고시공고",
           "https://www.boeun.go.kr/www/selectBbsNttList.do?bbsNo=66&key=194",
           require="selectBbsNttView"),
    # 단양군 — custom board, title col 2, action=read detail links
    _entry("단양군", "공지사항",
           "https://www.danyang.go.kr/dy21/975",
           title_col=2, require="action=read"),
]
