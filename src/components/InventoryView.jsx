import { useEffect, useMemo, useReducer, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import regionsData from '../data/regions.json'
import useRegionInventory from './useRegionInventory.js'
import { formatRelative } from '../lib/format.js'
import { makeColorScale } from '../lib/colorScale.js'
import { displayRegion } from '../lib/regionLabels.js'
import KpiStrip from './overview/KpiStrip.jsx'
import RegionCardV2 from './overview/RegionCardV2.jsx'
import SortControl from './overview/SortControl.jsx'
import RefreshButton from './overview/RefreshButton.jsx'
import RecentRail from './overview/RecentRail.jsx'
import {
  useOverviewSearch,
  OverviewSearchInput,
  OverviewSearchResults,
} from './overview/OverviewSearch.jsx'
import NoticeDetailModal from './NoticeDetailModal.jsx'

const SORT_KEY = 'clt-plus.overviewSort'
const VALID_SORTS = ['count', 'recent', 'name']
const RAIL_MIN_WIDTH = 1100

function readStoredSort() {
  try {
    const v = window.localStorage.getItem(SORT_KEY)
    if (VALID_SORTS.includes(v)) return v
  } catch {}
  return 'count'
}

// Tiny matchMedia hook for the rail's responsive gate. Listener cleanup is
// handled by the effect; no external dependency required.
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = e => setMatches(e.matches)
    setMatches(mql.matches)
    // Safari < 14 only supports addListener; modern browsers use addEventListener.
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [query])
  return matches
}

export default function InventoryView({ onPick, onPickSub, panelOpen }) {
  const inv = useRegionInventory()
  const { status, totalNotices, latestAt, byRegion, todayTotal, fetchedAt, refreshing } = inv

  const search = useOverviewSearch()
  const [openNotice, setOpenNotice] = useState(null)
  // RecentRail re-runs its query whenever this token bumps (manual refresh).
  const [railToken, bumpRail] = useReducer(n => n + 1, 0)

  const wideEnoughForRail = useMediaQuery(`(min-width: ${RAIL_MIN_WIDTH}px)`)
  const showRail = !panelOpen && wideEnoughForRail && !search.active

  // Silent revalidate when the user comes back to the tab after >5 min.
  // The store's loadInventory short-circuits when data is still fresh,
  // so calling unconditionally on every focus is safe and cheap.
  useEffect(() => {
    const onWindowFocus = () => { inv.refresh?.() }
    window.addEventListener('focus', onWindowFocus)
    return () => window.removeEventListener('focus', onWindowFocus)
    // inv.refresh is a stable module-level binding from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pre-compute the canonical region universe from regions.json so empty
  // regions are visible too (sorted to the bottom as muted chips).
  const allRegions = useMemo(
    () => regionsData.map(r => ({
      region: r.region,
      sourceCount: r.subEntities.reduce((n, s) => n + s.sources.length, 0),
      subCount: r.subEntities.length,
    })),
    [],
  )
  const subCountByRegion = useMemo(() => {
    const m = {}
    for (const r of allRegions) m[r.region] = r.subCount
    return m
  }, [allRegions])

  const activeKeys = new Set(byRegion.map(r => r.region))
  const inactiveRegions = allRegions
    .filter(r => !activeKeys.has(r.region))
    .sort((a, b) => a.region.localeCompare(b.region, 'ko'))

  const totalSources = useMemo(
    () => regionsData.reduce(
      (n, r) => n + r.subEntities.reduce((m, s) => m + s.sources.length, 0),
      0,
    ),
    [],
  )

  const [sort, setSort] = useState(readStoredSort)
  const updateSort = k => {
    setSort(k)
    try { window.localStorage.setItem(SORT_KEY, k) } catch {}
  }

  // Heat scale uses the count-desc max, not the currently-displayed max,
  // so re-sorting by 수집순/가나다순 doesn't re-tint every spine.
  const maxTotal = byRegion[0]?.total ?? 0
  const heat = useMemo(() => makeColorScale(maxTotal), [maxTotal])

  const sortedActive = useMemo(() => {
    const a = byRegion.map(r => ({ ...r, subCount: subCountByRegion[r.region] }))
    if (sort === 'recent') a.sort((x, y) => (y.latestAt ?? 0) - (x.latestAt ?? 0))
    else if (sort === 'name') a.sort((x, y) => x.region.localeCompare(y.region, 'ko'))
    return a
  }, [byRegion, subCountByRegion, sort])

  const kpiItems = [
    {
      key: 'total',
      label: '전체 공지',
      value: totalNotices.toLocaleString() + '건',
    },
    {
      key: 'today',
      label: '오늘 신규',
      value: `+${(todayTotal ?? 0).toLocaleString()}건`,
      accent: (todayTotal ?? 0) > 0,
      title: 'posted_at 기준 오늘 게시된 공지',
    },
    {
      key: 'regions',
      label: '활성 지역',
      value: `${byRegion.length} / ${allRegions.length}`,
    },
    {
      key: 'sources',
      label: '연동 소스',
      value: String(totalSources),
    },
    {
      key: 'latest',
      label: '최근 수집',
      value: formatRelative(latestAt),
    },
  ]

  const handleRefresh = () => {
    inv.refresh?.()
    bumpRail()
  }

  // Org-chip click in search results / rail: deep-link into the panel with
  // both region + sub pre-selected. Falls back to a region-only pick if the
  // app hasn't wired onPickSub.
  const pickOrg = (region, sub) => {
    if (onPickSub) onPickSub(region, sub)
    else onPick?.(region)
  }

  const showLoadingSkeletons = status === 'idle' || status === 'loading'
  const showErrorBlock = status === 'error'
  const showGrid = status === 'ready'

  return (
    <div
      style={{
        maxWidth: 1440,
        width: '100%',
        margin: '0 auto',
        padding: 20,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
      }}
    >
      <SectionTitle title="현황 개요" subtitle="전체 공지 · 실시간 Supabase 조회" />

      {/* ① Command row: nationwide search + refresh */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginTop: 14,
        }}
      >
        <OverviewSearchInput
          value={search.term}
          onChange={search.setTerm}
          style={{ flex: 1, minWidth: 260 }}
        />
        <RefreshButton
          refreshing={!!refreshing}
          fetchedAt={fetchedAt}
          onRefresh={handleRefresh}
        />
      </div>

      {/* ② KPIs always visible */}
      <KpiStrip loading={showLoadingSkeletons} items={kpiItems} />

      {search.active ? (
        <OverviewSearchResults
          debounced={search.debounced}
          state={search.state}
          period={search.period}
          onChangePeriod={search.setPeriod}
          onOpenNotice={setOpenNotice}
          onPickOrg={pickOrg}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'flex-start',
            marginTop: 24,
          }}
        >
          {/* Main column — region grid + zero-notice chips */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                borderBottom: '1px solid var(--border)',
                paddingBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  지역별 현황
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {sort === 'count' && '공지 수 기준 내림차순'}
                  {sort === 'recent' && '최근 수집 기준 내림차순'}
                  {sort === 'name' && '가나다순'}
                </span>
              </div>
              <SortControl value={sort} onChange={updateSort} />
            </div>

            {showLoadingSkeletons && <SkeletonGrid />}

            {showErrorBlock && (
              <ErrorBlock
                message={inv.error}
                onRetry={() => inv.refresh?.()}
              />
            )}

            {showGrid && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 14,
                    marginTop: 14,
                  }}
                >
                  {sortedActive.map(r => (
                    <RegionCardV2
                      key={r.region}
                      r={r}
                      heatColor={heat(r.total)}
                      onPick={onPick}
                    />
                  ))}
                </div>

                {inactiveRegions.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      공지 0건 지역 · {inactiveRegions.length}곳
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {inactiveRegions.map(r => (
                        <button
                          key={r.region}
                          type="button"
                          onClick={() => onPick?.(r.region)}
                          title={r.region}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 999,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'background 0.15s, color 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-card)'
                            e.currentTarget.style.color = 'var(--text-muted)'
                          }}
                        >
                          {displayRegion(r.region)}
                          <span style={{ opacity: 0.55, marginLeft: 6 }}>·{r.subCount}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ④ Recent-notices rail — only when there's room and the panel
              isn't already occupying the right side. */}
          {showRail && (
            <RecentRail
              onOpenNotice={setOpenNotice}
              onPickOrg={pickOrg}
              refreshToken={railToken}
            />
          )}
        </div>
      )}

      {openNotice && (
        <NoticeDetailModal notice={openNotice} onClose={() => setOpenNotice(null)} />
      )}
    </div>
  )
}

function SectionTitle({ title, subtitle, style }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 8,
        ...style,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {subtitle && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</span>
      )}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
        marginTop: 14,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            padding: '14px 16px 12px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            minHeight: 168,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: 'var(--border)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ height: 16, width: 84 }} />
            <div className="skeleton" style={{ height: 22, width: 56 }} />
          </div>
          <div className="skeleton" style={{ height: 12, width: 130 }} />
          <div className="skeleton" style={{ height: 12, width: '85%', marginTop: 6 }} />
          <div className="skeleton" style={{ height: 12, width: '70%' }} />
          <div className="skeleton" style={{ height: 12, width: '60%' }} />
          <div className="skeleton" style={{ height: 11, width: '55%', marginTop: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

function ErrorBlock({ message, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        marginTop: 14,
        padding: '20px 18px',
        background: '#FEF2F2',
        border: '1px solid var(--danger)',
        borderRadius: 'var(--radius)',
        color: 'var(--danger)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
        <AlertCircle size={16} />
        데이터를 불러오지 못했어요
      </div>
      {message && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-light)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
