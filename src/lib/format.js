// Date/time formatting helpers shared across the public UI.
//
// Until now these lived in 4 separate copies (InventoryView, NoticeList,
// NoticeDetailModal, RecentFeed) with slightly drifted behavior. Each
// function below is copied verbatim from its original implementation so
// the output strings stay byte-identical — this file is a consolidation,
// not a redesign.

// "Time since" for the relative-time KPIs / card footers (`최근 수집 · 12분 전`).
// Originally: InventoryView.formatRelative.
export function formatRelative(ts) {
  if (!ts) return '데이터 없음'
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}초 전`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  return `${day}일 전`
}

// Human-friendly notice-posted-on label (`오늘 / 어제 / N일 전 / YYYY년 M월 D일`).
// Originally: NoticeList.formatDate.
//
// Defensive against future-dated posts: a few sources in notices_v2 ship
// posted_at values in the future (인포21 = 2070-01-01 sentinel,
// 건설신기술특허플랫폼 ≈ today+5..14). Without the days<0 branch we'd
// render "-13일 전". The rail + overview-search filter these out at the
// query level (.lte('posted_at', today)) so they don't dominate
// discovery surfaces; this branch is the belt-and-suspenders for any
// future-dated row that still reaches a card render (e.g. when a user
// drills into the source's own region panel).
export function formatNoticeDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return iso
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days < 0) return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days <= 14) return `${days}일 전`
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// Dotted absolute date — used in the notice-detail modal header.
// Originally: NoticeDetailModal.formatDate.
export function formatDottedDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 'YYYY-MM-DD' for today's local date — used by the 오늘 신규 KPI and the
// per-card recency line. Mirrors how `lib/periodFilter.cutoffDateFor` builds
// its date strings (UTC slice) so the two features can never disagree on
// what "today" means. (Yes, this drifts from local time at the day boundary;
// that consistency-over-precision trade-off is documented in the blueprint.)
export function todayYMD() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

// 'YYYY-MM-DD' for N days ago — for the 7-day recency aggregate.
export function ymdDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// "HH:MM" for the RefreshButton caption (`조회 HH:MM`).
export function formatHM(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
