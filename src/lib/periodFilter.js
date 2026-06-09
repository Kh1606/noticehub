// Period filter for the right-side notice panel.
//
// Filters notices by posted_at (YYYY-MM-DD text column) using a few preset
// windows. State is persisted in localStorage so the user's preference
// survives reloads and switching between regions.

export const PERIODS = [
  { key: '1d',  label: '1일',   days: 1 },
  { key: '3d',  label: '3일',   days: 3 },
  { key: '1w',  label: '1주',   days: 7 },
  { key: '1m',  label: '1개월', days: 30 },
  { key: 'all', label: '전체',  days: null },
]

export const DEFAULT_PERIOD = '1w'

const STORAGE_KEY = 'clt-notice-period'

export function periodConfig(key) {
  return PERIODS.find(p => p.key === key) || PERIODS.find(p => p.key === DEFAULT_PERIOD)
}

export function readStoredPeriod() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && PERIODS.some(p => p.key === v)) return v
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through
  }
  return DEFAULT_PERIOD
}

export function writeStoredPeriod(key) {
  try { window.localStorage.setItem(STORAGE_KEY, key) } catch {}
}

// Returns 'YYYY-MM-DD' for posted_at .gte() filter, or null for 'all'.
export function cutoffDateFor(key) {
  const cfg = periodConfig(key)
  if (!cfg || cfg.days == null) return null
  const d = new Date()
  d.setDate(d.getDate() - cfg.days)
  return d.toISOString().slice(0, 10)
}

// Human-readable date-range hint shown under the chips: "2026-06-02 ~ 2026-06-09"
// or "전체 기간" when no cutoff applies.
export function dateRangeLabel(key) {
  const cutoff = cutoffDateFor(key)
  if (!cutoff) return '전체 기간'
  const today = new Date().toISOString().slice(0, 10)
  return `${cutoff} ~ ${today}`
}
