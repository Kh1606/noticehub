import { useMemo } from 'react'
import regionsData from '../../data/regions.json'
import useRegionInventory from '../useRegionInventory.js'
import { NON_GEOGRAPHIC_REGIONS } from './regionNameMap.js'
import KoreaMap from './KoreaMap.jsx'

/**
 * Map mode shell.
 *
 * Selection state lives in App.jsx (shared with InventoryView). When the
 * user clicks a province, a sub-region, or an "unzoned" chip, we call up
 * to App and the shared RegionDetailPanel renders on the right.
 */
export default function MapView({ selected, onPickRegion, onPickSub }) {
  const inv = useRegionInventory(30)

  // Region totals from the inventory roll-up.
  const countsByRegion = useMemo(() => {
    const m = {}
    for (const r of inv.byRegion) m[r.region] = r.total
    return m
  }, [inv.byRegion])

  // Per-region per-sub counts: { regionName: { subName: count } }.
  const countsBySub = useMemo(() => {
    const m = {}
    for (const r of inv.byRegion) {
      const inner = {}
      for (const e of r.byEntity) inner[e.name] = e.count
      m[r.region] = inner
    }
    return m
  }, [inv.byRegion])

  const unzonedRegions = useMemo(
    () => regionsData
      .filter(r => NON_GEOGRAPHIC_REGIONS.has(r.region))
      .map(r => ({ region: r.region, count: r.subEntities.length })),
    [],
  )

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        margin: '20px auto',
        padding: '0 20px',
        width: '100%',
        maxWidth: 1440,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            대한민국 공공기관 지도
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            최근 30일 공지 수 기준 히트맵 ·
            {inv.status === 'loading' && ' 데이터 불러오는 중…'}
            {inv.status === 'ready' && ` 전체 ${inv.totalNotices.toLocaleString()}건`}
            {inv.status === 'error' && ' 데이터 연결 오류'}
          </div>
        </div>

        {/* Non-geographic regions surfaced as chips (no map polygon for them) */}
        {unzonedRegions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              지역 미지정
            </span>
            {unzonedRegions.map(({ region, count }) => {
              const isActive = selected?.region === region
              return (
                <button
                  key={region}
                  onClick={() => onPickRegion?.(region)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 500,
                    background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    cursor: 'pointer',
                  }}
                >
                  {region} <span style={{ opacity: 0.65 }}>· {count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 480 }}>
        <KoreaMap
          countsByRegion={countsByRegion}
          countsBySub={countsBySub}
          selectedRegionName={selected?.region ?? null}
          selectedSubName={selected?.sub ?? null}
          onPickRegion={onPickRegion}
          onPickSub={onPickSub}
        />
      </div>
    </div>
  )
}
