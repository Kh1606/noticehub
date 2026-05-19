import { useMemo } from 'react'
import regionsData from '../data/regions.json'
import useRegionInventory from './useRegionInventory.js'


function formatRelative(ts) {
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

export default function InventoryView({ onPick }) {
  const { status, totalNotices, latestAt, byRegion } = useRegionInventory()

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
  const activeRegions = byRegion
  const activeKeys = new Set(activeRegions.map(r => r.region))
  const inactiveRegions = allRegions
    .filter(r => !activeKeys.has(r.region))
    .sort((a, b) => a.region.localeCompare(b.region, 'ko'))

  const totalSources = regionsData.reduce(
    (n, r) => n + r.subEntities.reduce((m, s) => m + s.sources.length, 0),
    0,
  )

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

      <StatsStrip
        stats={[
          { label: '전체 공지', value: totalNotices.toLocaleString() + '건' },
          { label: '활성 지역', value: `${activeRegions.length} / ${allRegions.length}` },
          { label: '연동 소스', value: totalSources.toString() },
          { label: '최근 수집', value: formatRelative(latestAt) },
        ]}
        loading={status === 'loading'}
      />

      <SectionTitle title="지역별 현황" subtitle="공지 수 기준 내림차순" style={{ marginTop: 32 }} />

      {status === 'loading' && <SkeletonGrid />}
      {status === 'error' && (
        <div style={{ color: 'var(--text-muted)', marginTop: 12 }}>
          데이터를 불러오지 못했어요.
        </div>
      )}

      {status === 'ready' && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
              marginTop: 14,
            }}
          >
            {activeRegions.map(r => (
              <RegionCard key={r.region} r={r} maxTotal={activeRegions[0]?.total ?? 1} onPick={onPick} />
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
                아직 공지가 없는 지역
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {inactiveRegions.map(r => (
                  <button
                    key={r.region}
                    onClick={() => onPick?.(r.region)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {r.region}
                    <span style={{ opacity: 0.55, marginLeft: 6 }}>·{r.subCount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
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

function StatsStrip({ stats, loading }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginTop: 14,
      }}
    >
      {stats.map(s => (
        <div
          key={s.label}
          style={{
            padding: '14px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {s.label}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
              opacity: loading ? 0.35 : 1,
            }}
          >
            {loading ? '…' : s.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function RegionCard({ r, maxTotal, onPick }) {
  const top = r.byEntity.slice(0, 4)
  const fill = Math.max(0.08, r.total / maxTotal)
  return (
    <button
      onClick={() => onPick?.(r.region)}
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: '14px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      {/* progress strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${fill * 100}%`,
          height: 3,
          background: 'var(--accent)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {r.region}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
          {r.total.toLocaleString()}
        </div>
      </div>

      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
        {top.map(e => (
          <li
            key={e.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--text-secondary)',
              padding: '2px 0',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.name}
            </span>
            <span style={{ marginLeft: 8, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
              {e.count}
            </span>
          </li>
        ))}
        {r.byEntity.length > 4 && (
          <li
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              paddingTop: 2,
            }}
          >
            +{r.byEntity.length - 4}개 기관
          </li>
        )}
      </ul>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        최근 수집 · {formatRelative(r.latestAt)}
      </div>
    </button>
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
            height: 144,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  )
}
