// Secondary `notice_details` lookup that enriches a notices page with
// each notice's attachments list.
//
// The frontend used to fetch attachments on demand from the
// fetch-notice-detail Edge Function (when the in-app modal opened).
// That modal is gone; instead, every notices list paint now pre-loads
// attachments inline so each card can show the 📎 button only when
// there's actually something to download.
//
// One batched query per page (`.in('notice_id', ids)`) → PK-indexed,
// cheap. Notices whose row hasn't been warmed yet just get `attachments: []`,
// which means the card renders no attach button — clicking it opens the
// source URL like normal.

import { supabase } from './supabase.js'

export async function attachAttachments(notices) {
  if (!notices?.length) return notices || []
  const ids = notices.map(n => n.notice_id)
  const { data, error } = await supabase
    .from('notice_details')
    .select('notice_id,attachments')
    .in('notice_id', ids)
    .eq('status', 'ok')
  if (error) {
    // Never block the notice render if this side-query fails — worst
    // case is no 📎 buttons show. Surface to console for debugging.
    console.warn('attachAttachments: secondary fetch failed', error.message)
    return notices.map(n => ({ ...n, attachments: [] }))
  }
  const map = Object.fromEntries(
    (data || []).map(r => [r.notice_id, r.attachments || []]),
  )
  return notices.map(n => ({ ...n, attachments: map[n.notice_id] || [] }))
}
