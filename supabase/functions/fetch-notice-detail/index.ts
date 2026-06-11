// Supabase Edge Function — fetch-notice-detail (v3 — attachments only)
//
// Body-text extraction was removed on 2026-06-11 when the in-app notice
// modal was deleted. The frontend now opens detail_url in a new tab and
// pre-loads attachments via a separate notice_details query — the EF is
// no longer in the frontend's request path. It's kept deployed as a
// safety net + as the live fetcher the warmer can call as fallback.
//
// Call shape: POST { notice_id, detail_url } → returns
// { cached, attachments, status, error_text }.
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

interface Attachment {
  name: string
  url: string
  ext: string
  js_only?: boolean
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

const JS_DOWNLOAD_RE = /(?:fn|f|file)(?:Down|Download|Atch|AtchFile|AttachFile|FileDown|FileDownload)\b|fileDown\b|downloadFile\b|atchFileDown\b/i

function pickNameFromText($el: cheerio.Cheerio<any>): string {
  let text = ($el.text() || '').replace(/\s+/g, ' ').trim()
  text = text.replace(/^[\[\(](?:pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip)[\]\)]\s*/i, '')
  if (text && text.length < 200 && !GENERIC_NAMES.has(text)) return text
  const title = ($el.attr('title') || '').trim()
  if (title && title.length < 200 && !GENERIC_NAMES.has(title)) return title
  return ''
}

function extractAttachments(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  sourceDetailUrl: string,
): Attachment[] {
  const seen = new Set<string>()
  const out: Attachment[] = []

  $('a').each((_, el) => {
    const $el = $(el)
    const href = ($el.attr('href') || '').trim()
    const onclick = ($el.attr('onclick') || '').trim()
    const text = ($el.text() || '').trim()
    const title = ($el.attr('title') || '').trim()

    const hrefHasExt = !!href && FILE_EXT_RE.test(href)
    const hrefIsReal = !!href && !href.startsWith('javascript:') && !href.startsWith('#')
    const textHasExt = FILE_EXT_RE.test(text) || FILE_EXT_RE.test(title)
    const onclickLooksLikeDownload = !!onclick && JS_DOWNLOAD_RE.test(onclick)

    // Case A — real href to a file
    if (hrefIsReal && (hrefHasExt || textHasExt)) {
      let abs: string
      try {
        abs = new URL(href, baseUrl).toString()
      } catch {
        return
      }
      if (seen.has(abs)) return
      seen.add(abs)
      const name = pickFilename($el, abs)
      const m1 = abs.match(FILE_EXT_RE)
      const m2 = name.match(FILE_EXT_RE)
      const ext = (m1?.[1] || m2?.[1] || '').toLowerCase()
      out.push({ name, url: abs, ext })
      return
    }

    // Case B — JavaScript download handler. We can't trigger the actual
    // download, but we know the file name. Surface as a hint that opens
    // the source detail page so the user can click through there.
    if ((onclickLooksLikeDownload || !!onclick) && textHasExt) {
      const name = pickNameFromText($el)
      if (!name) return
      const key = 'JS::' + name
      if (seen.has(key)) return
      seen.add(key)
      const m = name.match(FILE_EXT_RE)
      const ext = (m?.[1] || '').toLowerCase()
      out.push({ name, url: sourceDetailUrl, ext, js_only: true } as Attachment)
      return
    }
  })

  return out
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
  // Body extraction was removed 2026-06-11; the old body_text filter
  // ("v1 cache rows are stale") is no longer meaningful — we only need
  // attachments and a sane TTL.
  const { data: cached } = await supabase
    .from('notice_details')
    .select('attachments, status, error_text, fetched_at')
    .eq('notice_id', noticeId)
    .maybeSingle()

  if (
    cached &&
    cached.status === 'ok' &&
    Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS
  ) {
    return jsonResponse({
      cached: true,
      attachments: cached.attachments || [],
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
      const $ = cheerio.load(html)
      attachments = extractAttachments($, detailUrl, detailUrl)
    }
  } catch (e) {
    status = 'error'
    errorText = `${(e as Error).name}: ${(e as Error).message?.slice(0, 200)}`
  }

  // ─── Persist (best-effort) ───
  // body_text was dropped from the upsert on 2026-06-11. The DB column
  // still exists and just holds NULL for new rows.
  try {
    await supabase
      .from('notice_details')
      .upsert({
        notice_id: noticeId,
        attachments,
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
    status,
    error_text: errorText,
  })
})
