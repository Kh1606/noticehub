"""
경상남도 — .web CMS sites (Playwright-rendered).

Detection order inside playwright_web.py: ul.lst1 → div.list1table4 → table.
창원시 uses the table fallback (amode=view links in col 1).
함양군 고시 returns 0 items (JS-loaded beyond networkidle) — skipped.
"""
from scrapers.base import SourceMeta
from scrapers._helpers.playwright_web import make_playwright_web


def _entry(sub, page, url, **opts):
    src = SourceMeta(region="경상남도", sub_entity=sub, source_page=page, source_url=url)
    return src, make_playwright_web(src, **opts)


SCRAPERS = [
    # 창원시 — table layout; 공지 title at col 1, 고시 has extra category col → col 2
    _entry("창원시", "공지사항",
           "https://www.changwon.go.kr/cwportal/10310/10429/10430.web"),
    _entry("창원시", "고시공고",
           "https://www.changwon.go.kr/cwportal/10310/10438/10439.web", title_col=2),
    # 진주시 — lst1 layout
    _entry("진주시", "공지사항",
           "https://www.jinju.go.kr/00130/02730/00136.web"),
    _entry("진주시", "고시공고",
           "https://www.jinju.go.kr/00130/02730/05586.web"),
    # 김해시 — lst1 layout
    _entry("김해시", "공지사항",
           "https://www.gimhae.go.kr/03360/00023/00024.web"),
    _entry("김해시", "고시공고",
           "https://www.gimhae.go.kr/03360/00023/00029.web"),
    # 통영시 — lst1 layout
    _entry("통영시", "공지사항",
           "https://www.tongyeong.go.kr/00852/00853/00854.web"),
    _entry("통영시", "고시공고",
           "https://www.tongyeong.go.kr/00852/00853/00858.web"),
    # 사천시 — lst1 layout
    _entry("사천시", "공지사항",
           "https://www.sacheon.go.kr/news/00009/00010.web"),
    _entry("사천시", "고시공고",
           "https://www.sacheon.go.kr/news/00009/00014.web"),
    # 함안군 — lst1 layout
    _entry("함안군", "공지사항",
           "https://www.haman.go.kr/00059/06642/06643.web"),
    _entry("함안군", "고시공고",
           "https://www.haman.go.kr/00059/06642/06644.web"),
    # 창녕군 — lst1 layout
    _entry("창녕군", "공지사항",
           "https://www.cng.go.kr/03516/01549.web"),
    _entry("창녕군", "고시공고",
           "https://www.cng.go.kr/03517/01553/01553.web"),
    # 하동군 — lst1 layout
    _entry("하동군", "공지사항",
           "https://www.hadong.go.kr/media/00008/00009.web"),
    _entry("하동군", "고시공고",
           "https://www.hadong.go.kr/media/00012.web"),
    # 함양군 — lst1 layout (공지만; 고시는 JS-loaded beyond networkidle)
    _entry("함양군", "공지사항",
           "https://www.hygn.go.kr/00429/00543/00547.web"),
    # 거창군 — lst1 layout
    _entry("거창군", "공지사항",
           "https://www.geochang.go.kr/00445/00450.web"),
    _entry("거창군", "고시공고",
           "https://www.geochang.go.kr/00445/00451.web"),
    # 합천군 — lst1 layout
    _entry("합천군", "공지사항",
           "https://www.hc.go.kr/04923/04924/04945.web"),
    _entry("합천군", "고시공고",
           "https://www.hc.go.kr/04923/04924/04948.web"),
]
