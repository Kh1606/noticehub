// Supabase Edge Function — fetch-notice-detail (v2)
//
// On click of a notice card, the frontend invokes this with
// { notice_id, detail_url }. The function:
//   1. Looks up notice_details row for notice_id.
//   2. Cache hit if: status='ok' AND body_text NOT NULL AND fetched_at < 7d.
//   3. Else: validate URL matches the notice (abuse-prevention), fetch
//      the detail page, extract body text + attachments, upsert, return.
//   4. On fetch error, persist status='error' so we don't keep retrying
//      within the TTL window.
//
// Required Edge Function env (auto-injected by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// IMPORTANT: deploy with verify_jwt = FALSE.
//   Browser OPTIONS preflight carries no Authorization header, so the
//   Supabase gateway 401s it with verify_jwt on — the real POST never
//   arrives and the user sees a CORS error. Function-level
//   abuse-prevention below is sufficient: notice_id must exist in
//   notices_v2 with a matching detail_url, so this can't be used as
//   a generic URL fetcher.
//
//   Dashboard: Edge Functions → fetch-notice-detail → Settings →
//              toggle "Verify JWT" OFF.
//   CLI:       supabase functions deploy fetch-notice-detail --no-verify-jwt

// @ts-nocheck — Deno runtime; IDE type-checks against Node and flags the
// remote `https://` imports + `Deno` global. Both work at runtime on Supabase.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12'

const TTL_MS = 7 * 24 * 60 * 60 * 1000  // 7 days
const BODY_MAX_CHARS = 2000

// File extensions we treat as downloadable attachments.
const FILE_EXT_RE = /\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|bmp|hwt|txt|csv|7z|tar|gz|rar)(\?|$)/i

// Keys often used by Korean gov sites to carry the original filename
// in a download URL (e.g. ?atchFileNm=공모안내문.hwp).
const FILENAME_QUERY_KEYS = [
  'filename', 'fileName', 'file_name', 'fileNm', 'file_nm',
  'atchFileNm', 'sFileNm', 'sFileName', 'attachName',
  'attachFileName', 'atchmnflNm', 'fname', 'origFileName',
]

// Generic anchor-text values to treat as "no usable name".
const GENERIC_NAMES = new Set([
  '', '다운로드', '내려받기', 'Download', 'DOWNLOAD', 'download',
  '첨부', '첨부파일', '바로보기', '미리보기', '📎', 'View',
])

// Selectors to try (in order) for the announcement body content.
const BODY_SELECTORS = [
  '.board_view', '.board-view', '.view_con', '.view-content',
  '.bbs_view', '.bbs-view', '.bbs-content', '.bbs_detail',
  '.contents', '#contents', '.cont', '.content', '#content',
  'td.contents', 'td.cont', 'td.content',
  '.detail-content', '.detail_content', '.detail',
  '.article', 'article',
  '[role="main"]', 'main',
]

// Stripped before extraction (these never contain real body content).
// <form> added so password dialogs disappear with the rest of the chrome.
const STRIP_TAGS = 'script,style,noscript,iframe,nav,header,footer,aside,form'
const STRIP_CLASS_RE = /(?:^|\s|_|-)(nav|menu|header|footer|sidebar|breadcrumb|gnb|lnb|skip|util|topmenu|leftmenu|btn_area|paging|search_area|pwd|password|confirm|cancel|prev|next|list_btn|board_info|board_list|copyright|list_top|list_bot|list_foot|list_head|sub_top|popup|dialog)(?:\s|$|_|-)/i

// Tail markers — cut body at the first occurrence.
const TAIL_MARKERS = [
  '비밀번호 확인',
  '비밀번호확인',
  '글 작성 시 입력한',
  '자유이용이 불가합니다',
  '저작권 정책',
  '공공누리',
]

// Lines whose stripped text exactly matches one of these are dropped.
const LABEL_LINES = new Set([
  '제목', '작성자', '작성일', '조회수', '첨부파일',
  '내용', '바로보기', '담당부서', '부서', '담당자', '작성부서',
  '목록', '이전글', '다음글',
])

// A line is "real content" if it's long OR contains these markers.
const CONTENT_KEYWORD_RE = /공고|안내|모집|사업|개최|시행|선정|채용|입찰|계약|발주|선발|관련|아래와/

interface Attachment {
  name: string
  url: string
  ext: string
}

function pickFilename($el: cheerio.Cheerio<any>, abs: string): string {
  // 1. title attribute
  const title = ($el.attr('title') || '').trim()
  if (title && title.length < 200 && !GENERIC_NAMES.has(title)) return title

  // 2. URL query params — common Korean gov file-name keys
  try {
    const u = new URL(abs)
    for (const k of FILENAME_QUERY_KEYS) {
      const v = u.searchParams.get(k)
      if (v) {
        try {
          const dec = decodeURIComponent(v.replace(/\+/g, ' ')).trim()
          if (dec && dec.length < 300) return dec
        } catch {
          if (v.trim()) return v.trim()
        }
      }
    }
  } catch {
    // ignore — fall through
  }

  // 3. Anchor text (cleaned)
  let text = ($el.text() || '').replace(/\s+/g, ' ').trim()
  // Strip a leading file-extension badge like "[PDF]" or "(HWP)"
  text = text.replace(/^[\[\(](?:pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip)[\]\)]\s*/i, '')
  if (text && text.length < 200 && !GENERIC_NAMES.has(text)) return text

  // 4. URL pathname last segment, decoded
  try {
    const last = decodeURIComponent(new URL(abs).pathname.split('/').pop() || '')
    if (last) return last
  } catch {
    // ignore
  }

  return abs
}

function extractAttachments($: cheerio.CheerioAPI, baseUrl: string): Attachment[] {
  const seen = new Set<string>()
  const out: Attachment[] = []

  $('a[href]').each((_, el) => {
    const $el = $(el)
    const href = ($el.attr('href') || '').trim()
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return

    // Match in either the URL OR the visible text (some download links hide
    // the extension in JS but display "공고문.pdf" as the label).
    const text = ($el.text() || '').trim()
    const title = ($el.attr('title') || '').trim()
    const hrefHasExt = FILE_EXT_RE.test(href)
    const textHasExt = FILE_EXT_RE.test(text) || FILE_EXT_RE.test(title)
    if (!hrefHasExt && !textHasExt) return

    let abs: string
    try {
      abs = new URL(href, baseUrl).toString()
    } catch {
      return
    }
    if (seen.has(abs)) return
    seen.add(abs)

    const name = pickFilename($el, abs)
    // Determine extension: URL first, then name
    const m1 = abs.match(FILE_EXT_RE)
    const m2 = name.match(FILE_EXT_RE)
    const ext = (m1?.[1] || m2?.[1] || '').toLowerCase()

    out.push({ name, url: abs, ext })
  })

  return out
}

// Find a th/dt cell whose text equals "내용" / "본문" and return its sibling text.
// Korean gov sites almost universally use a th-td or dt-dd layout for detail
// pages — this gets us the actual body in one shot, ahead of generic selectors.
function findLabeledContent($: cheerio.CheerioAPI): string {
  for (const label of ['내용', '본문', '내 용']) {
    const target = label.replace(/\s+/g, '')
    const cell = $('th, dt').filter((_, el) => {
      const t = ($(el).text() || '').replace(/\s+/g, '').trim()
      return t === target
    }).first()
    if (cell.length === 0) continue
    const sibling = cell.next('td, dd')
    if (sibling.length === 0) continue
    const t = blockText($, sibling.get(0))
    if (t.length >= 80) return t
  }
  return ''
}

function cleanBody(text: string): string {
  let cleaned = text
  for (const marker of TAIL_MARKERS) {
    const idx = cleaned.indexOf(marker)
    if (idx >= 0) cleaned = cleaned.slice(0, idx).replace(/\s+$/, '')
  }
  // Cut on bottom-nav blocks like "\n목록\n…\n다음글…"
  cleaned = cleaned.replace(/\n목록\b[\s\S]*?(?:\n다음글[\s\S]*?(?=\n\n|$)|$)/g, '')
  cleaned = cleaned.replace(/\n이전글\b[\s\S]*?(?:\n다음글[\s\S]*?(?=\n\n|$)|$)/g, '')

  const lines = cleaned.split('\n')

  // Drop leading "menu-like" lines until we hit something real.
  let start = lines.length
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (line.length >= 30 || CONTENT_KEYWORD_RE.test(line)) {
      start = i
      break
    }
  }
  const trimmed = lines.slice(start)

  // Drop pure-label lines anywhere.
  const out: string[] = []
  for (const raw of trimmed) {
    if (LABEL_LINES.has(raw.trim())) continue
    out.push(raw)
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function extractBody($: cheerio.CheerioAPI): string {
  // 1) Try the labeled-content pattern BEFORE stripping chrome (the label
  //    cell may live under a parent whose class matches our strip regex).
  const labeled = findLabeledContent($)

  // 2) Strip chrome (nav/footer/forms/etc.) from the rest of the DOM.
  $(STRIP_TAGS).remove()
  $('*').each((_, el) => {
    const tag = el.tagName?.toLowerCase()
    if (!tag) return
    const cls = ($(el).attr('class') || '') + ' ' + ($(el).attr('id') || '')
    if (STRIP_CLASS_RE.test(cls)) $(el).remove()
  })

  let best = labeled

  // 3) Walk known content selectors; keep whichever beats current best.
  for (const sel of BODY_SELECTORS) {
    const $blocks = $(sel)
    if ($blocks.length === 0) continue
    $blocks.each((_, el) => {
      const t = blockText($, el)
      if (t.length > best.length) best = t
    })
  }

  // 4) Fallback — largest container block under <body>.
  if (!best) {
    let largest = ''
    $('body *').each((_, el) => {
      const tag = el.tagName?.toLowerCase()
      if (!tag || ['span', 'a', 'img', 'br', 'b', 'i', 'em', 'strong'].includes(tag)) return
      const t = blockText($, el)
      if (t.length > largest.length) largest = t
    })
    best = largest
  }

  if (!best) return ''

  // 5) Post-process: trim nav, drop labels, collapse blanks.
  let cleaned = cleanBody(best)
  if (cleaned.length < 50) cleaned = best  // over-cleaned; prefer noisy over empty
  return clipBody(cleaned)
}

function blockText($: cheerio.CheerioAPI, el: any): string {
  // Replace block-level closing tags with \n so paragraphs survive .text()
  const $el = $(el).clone()
  $el.find('p,div,br,li,tr,h1,h2,h3,h4,h5,h6,section,article').each((_, e) => {
    $(e).append('\n')
  })
  const raw = $el.text() || ''
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function clipBody(t: string): string {
  if (t.length <= BODY_MAX_CHARS) return t
  return t.slice(0, BODY_MAX_CHARS).replace(/\s+\S*$/, '').trim() + '…'
}

const HEADERS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...HEADERS_CORS },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: HEADERS_CORS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let payload: { notice_id?: string; detail_url?: string }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400)
  }
  const noticeId = (payload.notice_id || '').trim()
  const detailUrl = (payload.detail_url || '').trim()
  if (!noticeId || !detailUrl) {
    return jsonResponse({ error: 'notice_id and detail_url are required' }, 400)
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'service role env missing' }, 500)
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ─── Cache check ───
  // Treat rows missing body_text (v1 cache) as stale → re-fetch on next open
  const { data: cached } = await supabase
    .from('notice_details')
    .select('attachments, body_text, status, error_text, fetched_at')
    .eq('notice_id', noticeId)
    .maybeSingle()

  if (
    cached &&
    cached.status === 'ok' &&
    cached.body_text != null &&
    Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS
  ) {
    return jsonResponse({
      cached: true,
      attachments: cached.attachments || [],
      body_text: cached.body_text || '',
      status: 'ok',
    })
  }

  // ─── Abuse-prevention: confirm the detail_url actually belongs to this notice ───
  const { data: noticeRow } = await supabase
    .from('notices_v2')
    .select('detail_url')
    .eq('notice_id', noticeId)
    .maybeSingle()
  if (!noticeRow) {
    return jsonResponse({ error: 'unknown notice_id' }, 404)
  }
  if (noticeRow.detail_url !== detailUrl) {
    return jsonResponse({ error: 'detail_url does not match notice_id' }, 400)
  }

  // ─── Fetch + parse ───
  let attachments: Attachment[] = []
  let bodyText = ''
  let status: 'ok' | 'error' = 'ok'
  let errorText: string | null = null

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const resp = await fetch(detailUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!resp.ok) {
      status = 'error'
      errorText = `HTTP ${resp.status}`
    } else {
      // Some Korean gov sites serve EUC-KR. Detect from content-type;
      // otherwise default to UTF-8.
      const ctype = resp.headers.get('content-type') || ''
      const buf = await resp.arrayBuffer()
      let html: string
      if (/euc-kr/i.test(ctype)) {
        try {
          html = new TextDecoder('euc-kr').decode(buf)
        } catch {
          html = new TextDecoder('utf-8').decode(buf)
        }
      } else {
        html = new TextDecoder('utf-8').decode(buf)
      }
      // IMPORTANT: extract attachments BEFORE extractBody, since the
      // latter strips DOM elements as part of its cleanup pass.
      const $ = cheerio.load(html)
      attachments = extractAttachments($, detailUrl)
      bodyText = extractBody($)
    }
  } catch (e) {
    status = 'error'
    errorText = `${(e as Error).name}: ${(e as Error).message?.slice(0, 200)}`
  }

  // ─── Persist (best-effort) ───
  try {
    await supabase
      .from('notice_details')
      .upsert({
        notice_id: noticeId,
        attachments,
        body_text: bodyText || null,
        status,
        error_text: errorText,
        fetched_at: new Date().toISOString(),
      })
  } catch (e) {
    console.warn('notice_details upsert failed:', e)
  }

  return jsonResponse({
    cached: false,
    attachments,
    body_text: bodyText,
    status,
    error_text: errorText,
  })
})
