"""
Attachment extraction for notice detail pages.

Python port of the attachment logic in supabase/functions/fetch-notice-detail/index.ts.
Used by:
  • scrapers/warm_notice_details.py — standalone cache warmer
  • scrapers/run_all.py             — end-of-scrape warming

Body-text extraction was removed on 2026-06-11 — the in-app notice modal
is gone, the source page is now opened in a new tab, and the
notice_details cache stores only attachments going forward.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse, parse_qs, unquote_plus

from bs4 import BeautifulSoup, Tag

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


def _pick_name_from_text(a: Tag) -> str:
    """Pick a clean display name from anchor text/title, with JS-attach handling."""
    text = re.sub(r"\s+", " ", a.get_text() or "").strip()
    text = re.sub(
        r"^[\[(](?:pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip)[\])]\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    if text and len(text) < 200 and text not in GENERIC_NAMES:
        return text
    title = (a.get("title") or "").strip()
    if title and len(title) < 200 and title not in GENERIC_NAMES:
        return title
    return ""


def extract_attachments(soup: BeautifulSoup, base_url: str, *, source_detail_url: str | None = None) -> list[dict]:
    """Extract attachment-like elements.

    Returns a list of dicts:
      { name, url, ext, js_only? }
    where `js_only: True` indicates the anchor uses a JavaScript download
    handler (onclick) instead of a real href — i.e. we can't actually
    download the file, but we know its name. Modal renders these as a
    "원문에서 다운로드" hint row pointing at the source detail page.
    """
    seen: set[str] = set()
    out: list[dict] = []
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip()
        onclick = (a.get("onclick") or "").strip()
        text = (a.get_text() or "").strip()
        title = (a.get("title") or "").strip()

        # Decide whether this anchor LOOKS like an attachment.
        href_has_ext = bool(href and FILE_EXT_RE.search(href))
        href_is_real = bool(href) and not (
            href.startswith("javascript:") or href.startswith("#") or href == ""
        )
        text_has_ext = bool(FILE_EXT_RE.search(text) or FILE_EXT_RE.search(title))
        onclick_looks_like_download = bool(
            onclick and re.search(
                r"(?:fn|f|file)(?:Down|Download|Atch|AtchFile|AttachFile|FileDown|FileDownload)\b|fileDown\b|downloadFile\b|atchFileDown\b",
                onclick,
                re.IGNORECASE,
            )
        )

        # Case A — real href to a file: download works as-is.
        if href_is_real and (href_has_ext or text_has_ext):
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
            continue

        # Case B — JS-driven download (onclick handler + file extension visible):
        # we can't actually download, but we know the name. Surface as a hint.
        if (onclick_looks_like_download or onclick) and text_has_ext:
            name = _pick_name_from_text(a)
            if not name:
                continue
            # Dedupe by visible name (no URL we trust)
            dedupe_key = "JS::" + name
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            m = FILE_EXT_RE.search(name)
            ext = (m.group(1) if m else "").lower()
            out.append({
                "name": name,
                "url": source_detail_url or base_url,  # opens the detail page
                "ext": ext,
                "js_only": True,
            })
            continue

    return out



# ─── Top-level entry ─────────────────────────────────────────────────────

def extract_detail(html: str, base_url: str) -> dict:
    """Top-level: returns {attachments}.

    Body-text extraction was removed on 2026-06-11 — the notice-detail
    popup is gone; the source URL is opened in a new tab instead.
    """
    soup = BeautifulSoup(html, 'lxml')
    attachments = extract_attachments(soup, base_url, source_detail_url=base_url)
    return {'attachments': attachments}
