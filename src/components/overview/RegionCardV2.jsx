// v2 region card.
//
// Everything the v1 card showed is still here (region name, total, top-4
// orgs with counts, "+N개 기관", "최근 수집 · x전") — reorganized so the
// new recency signal and the heat-spine encoding fit naturally.
//
// Visual changes vs v1:
//   - Top 3px "progress strip" → 4px full-height heat spine on the left,
//     colored with the same makeColorScale() the map uses. Same input ⇒
//     same blue across 개요 and 지도.
//   - Big total stops using --accent (the spine now carries the volume
//     encoding), so the number stops competing with the heat color.
//   - New recency line: "오늘 +N · 7일 M" computed from posted_at, or
//     "최근 7일 신규 없음" when both are zero. Always rendered so card
//     heights stay equal across the grid.
//   - Footer adds the institution count ("기관 N · 최근 수집 …") next to
//     the existing relative time.

import { displayRegion } from '../../lib/regionLabels.js'
import { formatRelative } from '../../lib/format.js'

export default function RegionCardV2({ r, heatColor, onPick }) {
  const top = r.byEntity.slice(0, 4)
  const top1 = top[0]?.count || 0
  // subCount = total orgs configured for the region (incl. zero-notice ones),
  // joined in from regions.json by InventoryView. Fall back to "how many orgs
  // we actually have notices for" when the region isn't in regions.json (rare).
  const subCount = r.subCount ?? r.byEntity.length

  const todayNonZero = (r.todayCount ?? 0) > 0
  const weekNonZero = (r.weekCount ?? 0) > 0

  return (
    <button
      type="button"
      onClick={() => onPick?.(r.region)}
      title={r.region}
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: '14px 16px 12px 18px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        overflow: 'hidden',
        minHeight: 168,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        font: 'inherit',
        color: 'inherit',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
        e.currentTarget.style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Heat spine — same color scale as the map. Falls back to the
          neutral border color when the region has zero notices. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: heatColor ?? 'var(--border)',
          borderRadius: 'var(--radius) 0 0 var(--radius)',
        }}
      />

      {/* Header row: region name (display label) ··· big total */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
            wordBreak: 'keep-all',
          }}
        >
          {displayRegion(r.region)}
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-num)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {r.total.toLocaleString()}
        </div>
      </div>

      {/* Recency line — always present so cards stay the same height */}
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
        title="posted_at 기준"
      >
        {(todayNonZero || weekNonZero) ? (
          <>
            <span
              style={{
                color: todayNonZero ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: todayNonZero ? 600 : 400,
              }}
            >
              오늘 +{r.todayCount ?? 0}
            </span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span>7일 {r.weekCount ?? 0}</span>
          </>
        ) : (
          <span>최근 7일 신규 없음</span>
        )}
      </div>

      {/* Top-4 orgs + micro-bars */}
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
        {top.map(e => {
          const barPct = top1 > 0 ? Math.max(2, (e.count / top1) * 100) : 0
          return (
            <li
              key={e.name}
              style={{
                position: 'relative',
                fontSize: 12,
                color: 'var(--text-secondary)',
                padding: '3px 0 5px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {e.name}
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-num)',
                  }}
                >
                  {e.count}
                </span>
              </div>
              {/* Intra-region distribution bar — relative to the top org */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 2,
                  borderRadius: 1,
                  background: 'var(--border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${barPct}%`,
                    height: '100%',
                    background: 'var(--accent-weak-strong)',
                  }}
                />
              </div>
            </li>
          )
        })}
        {r.byEntity.length > 4 && (
          <li
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              paddingTop: 4,
            }}
          >
            +{r.byEntity.length - 4}개 기관
          </li>
        )}
      </ul>

      {/* Footer */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span>기관 {subCount}</span>
        <span>최근 수집 · {formatRelative(r.latestAt)}</span>
      </div>
    </button>
  )
}
