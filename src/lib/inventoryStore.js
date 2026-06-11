// Shared module-scoped inventory store.
//
// Until now `useRegionInventory()` was a normal React hook that ran inside
// each consumer (InventoryView + RegionDetailPanel + MapView). With three
// consumers that meant up to three independent full-table fetches per
// session — and on each view-mode switch the panel/chips flashed `…` while
// re-aggregating data the other consumer had already loaded.
//
// This module replaces that with one cached snapshot + a subscribe pattern.
// The rewritten `useRegionInventory` becomes a thin `useSyncExternalStore`
// wrapper around it, so every consumer reads the same data and only one
// fetch runs per 5-minute window.
//
// Public API (mirrors the old hook's shape, adds three fields):
//   { status, refreshing, totalNotices, latestAt, byRegion,
//     todayTotal, fetchedAt, error, rows }
//
// byRegion items each gain { todayCount, weekCount } on top of the existing
// { region, total, latestAt, byEntity }.

import { supabase } from './supabase.js'
import { todayYMD, ymdDaysAgo } from './format.js'

const PAGE_SIZE = 1000
const STALE_MS = 5 * 60 * 1000   // 5 min — after this, a focus event triggers a silent refetch

// Initial snapshot. **Always replace the whole object** when updating —
// useSyncExternalStore needs a stable reference between emits or it warns
// about infinite re-renders.
let state = {
  status: 'idle',          // 'idle' | 'loading' | 'ready' | 'error'
  refreshing: false,       // background refresh in flight (data still shown)
  rows: [],
  totalNotices: 0,
  latestAt: null,
  byRegion: [],
  todayTotal: 0,
  fetchedAt: 0,
  error: null,
}

const listeners = new Set()
const emit = () => { for (const fn of listeners) fn(state) }

async function fetchAllRows() {
  const all = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('notices_v2')
      .select('region,sub_entity,posted_at,scraped_at')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return all
}

function aggregate(rows) {
  const today = todayYMD()
  const weekCutoff = ymdDaysAgo(7)

  // Same group-by structure as the original useRegionInventory, plus the
  // per-group todayCount/weekCount counters (and the global todayTotal).
  const grouped = new Map()
  let latestAt = null
  let todayTotal = 0
  for (const row of rows) {
    const region = row.region || '-'
    const sub = row.sub_entity || '-'
    const t = row.scraped_at ? Date.parse(row.scraped_at) : null
    if (t && (!latestAt || t > latestAt)) latestAt = t

    let g = grouped.get(region)
    if (!g) {
      g = { region, total: 0, byEntity: new Map(), latestAt: null,
            todayCount: 0, weekCount: 0 }
      grouped.set(region, g)
    }
    g.total += 1
    g.byEntity.set(sub, (g.byEntity.get(sub) || 0) + 1)
    if (t && (!g.latestAt || t > g.latestAt)) g.latestAt = t

    // posted_at is a YYYY-MM-DD text column — string compare matches how
    // periodFilter.cutoffDateFor already queries it.
    if (row.posted_at) {
      if (row.posted_at === today) { g.todayCount += 1; todayTotal += 1 }
      if (row.posted_at >= weekCutoff) g.weekCount += 1
    }
  }

  const byRegion = Array.from(grouped.values())
    .map(g => ({
      region: g.region,
      total: g.total,
      latestAt: g.latestAt,
      byEntity: Array.from(g.byEntity.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      todayCount: g.todayCount,
      weekCount: g.weekCount,
    }))
    .sort((a, b) => b.total - a.total)

  return { totalNotices: rows.length, latestAt, byRegion, todayTotal }
}

export async function loadInventory({ force = false } = {}) {
  // Skip if we already have fresh data — unless the caller forces it (the
  // 새로고침 button does). A second concurrent call while loading is also a
  // no-op (the in-flight one will emit when it finishes).
  if (!force) {
    if (state.status === 'loading') return
    if (state.status === 'ready' && Date.now() - state.fetchedAt < STALE_MS) return
  }
  const isRefresh = state.status === 'ready'
  state = {
    ...state,
    status: isRefresh ? 'ready' : 'loading',
    refreshing: isRefresh,
  }
  emit()
  try {
    const rows = await fetchAllRows()
    const agg = aggregate(rows)
    state = {
      ...state,
      ...agg,
      rows,
      status: 'ready',
      refreshing: false,
      fetchedAt: Date.now(),
      error: null,
    }
  } catch (err) {
    state = {
      ...state,
      // Never blank out good data: if we already had a ready snapshot,
      // keep it and surface the error via the .error field instead of
      // dropping back to a full-page error state.
      status: state.rows.length ? 'ready' : 'error',
      refreshing: false,
      error: err?.message || String(err),
    }
  }
  emit()
}

export const refreshInventory = () => loadInventory({ force: true })
export const getInventory = () => state
export const subscribeInventory = fn => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
