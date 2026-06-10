"""
Body + attachment extraction for notice detail pages.

Python port of the logic in supabase/functions/fetch-notice-detail/index.ts.
Used by:
  • scrapers/warm_notice_details.py — standalone cache warmer
  • scrapers/run_all.py             — end-of-scrape warming

Keep the two sides (this file + index.ts) in sync. The Edge Function
remains the live fallback when a notice isn't pre-warmed.
"""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urljoin, urlparse, parse_qs, unquote_plus

from bs4 import BeautifulSoup, Tag

BODY_MAX_CHARS = 2000

FILE_EXT_RE = re.compile(
    r"\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|bmp|hwt|txt|csv|7z|tar|gz|rar)(\?|$)",
    re.IGNORECASE,
)

FILENAME_QUERY_KEYS = [
    "filename", "fileName", "file_name", "fileNm", "file_nm",
    "atchFileNm", "sFileNm", "sFileName", "attachName",
    "attachFileName", "atchmnflNm", "fname", "origFileName",
]

GENERIC_NAMES = {
    "", "다운로드", "내려받기", "Download", "DOWNLOAD", "download",
    "첨부", "첨부파일", "바로보기", "미리보기", "📎", "View",
}

BODY_SELECTORS = [
    ".board_view", ".board-view", ".view_con", ".view-content",
    ".bbs_view", ".bbs-view", ".bbs-content", ".bbs_detail",
    ".contents", "#contents", ".cont", ".content", "#content",
    ".detail-content", ".detail_content", ".detail",
    ".article", "article",
    "main",
]
# td-based selectors handled separately (BeautifulSoup CSS doesn't grok td.x easily)
BODY_TD_CLASSES = ["contents", "cont", "content"]

STRIP_TAGS = [
    "script", "style", "noscript", "iframe",
    "nav", "header", "footer", "aside", "form",
]

STRIP_CLASS_RE = re.compile(
    r"(?:^|\s|_|-)(nav|menu|header|footer|sidebar|breadcrumb|gnb|lnb|skip|util"
    r"|topmenu|leftmenu|btn_area|paging|search_area"
    r"|pwd|password|confirm|cancel|prev|next"
    r"|list_btn|board_info|board_list|copyright"
    r"|list_top|list_bot|list_foot|list_head|sub_top|popup|dialog)"
    r"(?:\s|$|_|-)",
    re.IGNORECASE,
)

# Tail markers — cut body at the first occurrence.
TAIL_MARKERS = [
    "비밀번호 확인",
    "비밀번호확인",
    "글 작성 시 입력한",
    "자유이용이 불가합니다",
    "저작권 정책",
    "공공누리",
]

# Lines whose text exactly matches one of these are dropped anywhere in the body.
LABEL_LINES = {
    "제목", "작성자", "작성일", "조회수", "첨부파일",
    "내용", "바로보기", "담당부서", "부서", "담당자", "작성부서",
    "목록", "이전글", "다음글",
}

# A line is considered "real content" if it's long OR contains these markers.
CONTENT_KEYWORDS = re.compile(r"공고|안내|모집|사업|개최|시행|선정|채용|입찰|계약|발주|선발|관련|아래와")


# ─── Attachment extraction ───────────────────────────────────────────────

def _pick_filename(a: Tag, abs_url: str) -> str:
    # 1. title attribute
    title = (a.get("title") or "").strip()
    if title and len(title) < 200 and title not in GENERIC_NAMES:
        return title

    # 2. URL query params
    try:
        u = urlparse(abs_url)
        qs = parse_qs(u.query)
        for k in FILENAME_QUERY_KEYS:
            if k in qs and qs[k]:
                v = qs[k][0]
                if v:
                    try:
                        dec = unquote_plus(v).strip()
                    except Exception:
                        dec = v.strip()
                    if dec and len(dec) < 300:
                        return dec
    except Exception:
        pass

    # 3. Anchor text (cleaned)
    text = re.sub(r"\s+", " ", a.get_text() or "").strip()
    text = re.sub(
        r"^[\[(](?:pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip)[\])]\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    if text and len(text) < 200 and text not in GENERIC_NAMES:
        return text

    # 4. URL pathname last segment, decoded
    try:
        last = unquote_plus(urlparse(abs_url).path.rsplit("/", 1)[-1] or "")
        if last:
            return last
    except Exception:
        pass

    return abs_url


def extract_attachments(soup: BeautifulSoup, base_url: str) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for a in soup.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href or href.startswith("javascript:") or href.startswith("#"):
            continue

        text = (a.get_text() or "").strip()
        title = (a.get("title") or "").strip()
        href_has_ext = bool(FILE_EXT_RE.search(href))
        text_has_ext = bool(FILE_EXT_RE.search(text) or FILE_EXT_RE.search(title))
        if not (href_has_ext or text_has_ext):
            continue

        try:
            abs_url = urljoin(base_url, href)
        except Exception:
            continue
        if abs_url in seen:
            continue
        seen.add(abs_url)

        name = _pick_filename(a, abs_url)
        m1 = FILE_EXT_RE.search(abs_url)
        m2 = FILE_EXT_RE.search(name)
        ext = (m1.group(1) if m1 else (m2.group(1) if m2 else "")).lower()
        out.append({"name": name, "url": abs_url, "ext": ext})
    return out


# ─── Body extraction ─────────────────────────────────────────────────────

def _strip_chrome(soup: BeautifulSoup) -> None:
    """Remove script/style/nav/etc. and class-name-flagged junk in place."""
    for tag in soup.find_all(STRIP_TAGS):
        tag.decompose()
    for el in list(soup.find_all(True)):
        cls = " ".join(el.get("class", []) or [])
        idv = el.get("id") or ""
        if cls and STRIP_CLASS_RE.search(cls):
            el.decompose()
            continue
        if idv and STRIP_CLASS_RE.search(idv):
            el.decompose()


def _block_text(el: Tag) -> str:
    """Convert an element to text, preserving paragraph breaks."""
    # Walk a fresh string-builder so we can inject \n at block tag boundaries.
    parts: list[str] = []
    for node in el.descendants:
        if isinstance(node, str):
            parts.append(node)
        elif isinstance(node, Tag):
            if node.name in {"br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article"}:
                parts.append("\n")
    raw = "".join(parts)
    return (
        raw.replace("\r\n", "\n")
           .replace("\xa0", " ")
    )


def _normalize(text: str) -> str:
    out = re.sub(r"[ \t]+", " ", text)
    out = re.sub(r"\n[ \t]+", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def _clip(text: str) -> str:
    if len(text) <= BODY_MAX_CHARS:
        return text
    cut = text[:BODY_MAX_CHARS]
    cut = re.sub(r"\s+\S*$", "", cut)
    return cut.strip() + "…"


def _find_labeled_content(soup: BeautifulSoup) -> str:
    """Find a th/dt cell whose text is '내용' (or '본문') and return its sibling text."""
    for label in ("내용", "본문", "내 용"):
        target = label.replace(" ", "")
        for cell in soup.find_all(["th", "dt"]):
            t = re.sub(r"\s+", "", cell.get_text() or "")
            if t == target:
                sib = cell.find_next_sibling(["td", "dd"])
                if sib:
                    text = _normalize(_block_text(sib))
                    if len(text) >= 80:
                        return text
    return ""


def _clean_body(text: str) -> str:
    """Post-process extracted text: cut tails, drop labels, trim nav leadings."""
    cleaned = text
    for marker in TAIL_MARKERS:
        idx = cleaned.find(marker)
        if idx >= 0:
            cleaned = cleaned[:idx].rstrip()
    # also cut on "목록\n이전글" style nav blocks
    cleaned = re.sub(r"\n목록\b.*?(?:\n다음글|\Z)", "", cleaned, flags=re.S)
    cleaned = re.sub(r"\n이전글\b.*?(?:\n다음글|\Z)", "", cleaned, flags=re.S)

    lines = cleaned.split("\n")

    # Drop leading lines that look like nav menu items
    start = 0
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue
        if len(line) >= 30 or CONTENT_KEYWORDS.search(line):
            start = i
            break
    else:
        start = len(lines)
    lines = lines[start:]

    # Drop pure-label lines anywhere
    out_lines = []
    for raw in lines:
        line = raw.strip()
        if line in LABEL_LINES:
            continue
        out_lines.append(raw)

    result = re.sub(r"\n{3,}", "\n\n", "\n".join(out_lines)).strip()
    return result


def extract_body(html_or_soup) -> str:
    soup = (
        html_or_soup
        if isinstance(html_or_soup, BeautifulSoup)
        else BeautifulSoup(html_or_soup, "lxml")
    )

    # Try the labeled-content pattern BEFORE we strip chrome (the label cell
    # may have a strip-matching class on its parent container).
    labeled = _find_labeled_content(soup)

    _strip_chrome(soup)

    best = labeled
    # Walk known content selectors; pick the largest text that beats `best`.
    for sel in BODY_SELECTORS:
        for el in soup.select(sel):
            t = _normalize(_block_text(el))
            if len(t) > len(best):
                best = t
    # td.contents / td.cont / td.content (CSS selector form)
    for cls in BODY_TD_CLASSES:
        for el in soup.find_all("td", class_=cls):
            t = _normalize(_block_text(el))
            if len(t) > len(best):
                best = t

    if not best:
        # Fallback — largest container under body
        body = soup.body or soup
        for el in body.find_all(True):
            if el.name in {"span", "a", "img", "br", "b", "i", "em", "strong"}:
                continue
            t = _normalize(_block_text(el))
            if len(t) > len(best):
                best = t

    if not best:
        return ""

    cleaned = _clean_body(best)
    if len(cleaned) < 50:
        cleaned = best  # over-cleaned; better noisy than empty

    return _clip(cleaned)


def extract_detail(html: str, base_url: str) -> dict:
    """Top-level: returns {body_text, attachments}."""
    soup = BeautifulSoup(html, "lxml")
    # Attachments use the un-stripped soup (preserves any anchor in the doc).
    # Body extraction makes its own copy via strip_chrome on the live soup;
    # we feed attachments BEFORE body, then body.
    attachments = extract_attachments(soup, base_url)
    body = extract_body(soup)  # mutates soup in place
    return {"body_text": body, "attachments": attachments}
