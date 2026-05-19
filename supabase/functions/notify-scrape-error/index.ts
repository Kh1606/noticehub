// Supabase Edge Function — notify-scrape-error
//
// Triggered by a Database Webhook on INSERT into public.scrape_errors.
// Sends an email via Resend HTTP API to the admin recipient list.
//
// Required Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   the re_... key from resend.com
//   ALERT_TO         comma-separated recipient emails, e.g. "admin@example.com"
//   ALERT_FROM       FROM address, e.g. "onboarding@resend.dev" or "alerts@yourdomain.com"
//
// Deploy via Supabase CLI:
//   supabase functions deploy notify-scrape-error
// OR paste this code in the dashboard editor.
//
// Webhook setup (Supabase Dashboard → Database → Webhooks → Create):
//   Name:   notify-scrape-error
//   Table:  public.scrape_errors
//   Events: INSERT
//   Type:   Supabase Edge Functions
//   Edge Function: notify-scrape-error
//   (Supabase auto-fills auth headers + JSON payload)

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

interface ScrapeErrorRow {
  id: number
  region: string | null
  sub_entity: string | null
  source_page: string | null
  url_tried: string
  status_code: number
  error_text: string | null
  occurred_at: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch (_e) {
    return new Response('invalid JSON', { status: 400 })
  }

  // Supabase webhook shape: { type, table, record, schema, old_record }
  const row: ScrapeErrorRow | undefined = payload?.record
  if (!row) {
    return new Response('no record in payload', { status: 400 })
  }

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_KEY) {
    console.error('RESEND_API_KEY env var is not set')
    return new Response('RESEND_API_KEY not configured', { status: 500 })
  }
  const TO_LIST = (Deno.env.get('ALERT_TO') || 'azimjon1606@gmail.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const FROM = Deno.env.get('ALERT_FROM') || 'onboarding@resend.dev'

  const subEntity = row.sub_entity || '?'
  const region = row.region || '—'
  const sourcePage = row.source_page || '—'
  const urlTried = row.url_tried || '—'
  const code = row.status_code
  const occurred = row.occurred_at
  const errorText = row.error_text || ''

  const subject = `[CLT+] 스크래퍼 오류 ${code} — ${subEntity}`

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111827;max-width:600px">
  <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:14px 18px;margin-bottom:18px">
    <div style="font-size:12px;font-weight:700;color:#B91C1C;letter-spacing:.4px;text-transform:uppercase;margin-bottom:4px">
      스크래퍼 오류
    </div>
    <div style="font-size:18px;font-weight:700;color:#7F1D1D">
      HTTP ${code} · ${escapeHtml(subEntity)}
    </div>
  </div>

  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;width:100%">
    <tbody>
      <tr><td style="padding:6px 12px 6px 0;color:#6B7280;width:120px">지역</td><td>${escapeHtml(region)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6B7280">기관</td><td><b>${escapeHtml(subEntity)}</b></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6B7280">페이지</td><td>${escapeHtml(sourcePage)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6B7280">HTTP 코드</td><td><span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:999px;font-weight:700;font-size:12px">${code}</span></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6B7280;vertical-align:top">요청 URL</td><td style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all"><a href="${escapeHtml(urlTried)}" style="color:#2563EB">${escapeHtml(urlTried)}</a></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6B7280;vertical-align:top">오류 내용</td><td style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#7F1D1D">${escapeHtml(errorText)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6B7280">발생 시각</td><td>${escapeHtml(occurred)}</td></tr>
    </tbody>
  </table>

  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280">
    <a href="https://kh1606.github.io/clt-plus2/#/admin/errors" style="color:#2563EB;text-decoration:none;font-weight:600">
      → 관리자 페이지에서 오류 로그 보기
    </a>
  </div>
</div>
`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: TO_LIST,
      subject,
      html,
    }),
  })

  if (!r.ok) {
    const txt = await r.text()
    console.error(`Resend ${r.status}: ${txt}`)
    return new Response(`resend ${r.status}: ${txt}`, { status: 502 })
  }

  return new Response(JSON.stringify({ ok: true, error_id: row.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
