// Supabase Edge Function — fetch-notice-detail
//
// On first click of a notice card, the frontend invokes this function with
// { notice_id, detail_url }. The function:
//   1. Looks up notice_details row for notice_id.
//   2. If cached AND status='ok' AND fetched_at < 7 days ago → return cached.
//   3. Else: validate the URL matches the notice (abuse-prevention), fetch
//      the detail page, parse attachments with cheerio, upsert + return.
//   4. On fetch error, persist status='error' with error_text so we don't
//      keep retrying within the TTL window.
//
// Required Edge Function env (auto-injected by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// IMPORTANT: deploy with verify_jwt = FALSE.
//   Supabase's gateway rejects browser OPTIONS preflight requests
//   (they carry no Authorization header) with 401 when verify_jwt is
//   on — the actual POST never reaches this function and the user
//   sees a CORS error. Function-level abuse prevention is handled
//   below: we look up notice_id in notices_v2 and bail unless the
//   detail_url matches, so the function can't be used as a generic
//   URL fetcher.
//
//   Dashboard: Edge Functions → fetch-notice-detail → Settings →
//              toggle "Verify JWT" OFF.
//   CLI:       supabase functions deploy fetch-notice-detail --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12'

const TTL_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

// File extensions we treat as downloadable attachments.
const FILE_EXT_RE = /\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|bmp|hwt|txt|csv|7z|tar|gz|rar)(\?|$)/i

interface Attachment {
  name: string
  url: string
  ext: string
}

function extractAttachments(html: string, baseUrl: string): Attachment[] {
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const out: Attachment[] = []

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim()
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return
    if (!FILE_EXT_RE.test(href)) return

    let abs: string
    try {
      abs = new URL(href, baseUrl).toString()
    } catch {
      return
    }
    if (seen.has(abs)) return
    seen.add(abs)

    // Prefer the anchor text as the displayed filename; fall back to last URL segment.
    let name = ($(el).text() || '').replace(/\s+/g, ' ').trim()
    if (!name || name.length > 200) {
      try {
        name = decodeURIComponent(new URL(abs).pathname.split('/').pop() || abs)
      } catch {
        name = abs
      }
    }
    const m = abs.match(FILE_EXT_RE)
    const ext = (m?.[1] || '').toLowerCase()
    out.push({ name, url: abs, ext })
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
      // Some Korean gov sites serve EUC-KR. Try to detect from content-type;
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
      attachments = extractAttachments(html, detailUrl)
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
        status,
        error_text: errorText,
        fetched_at: new Date().toISOString(),
      })
  } catch (e) {
    console.warn('notice_details upsert failed:', e)
  }

  return jsonResponse({ cached: false, attachments, status, error_text: errorText })
})
