import { useEffect, useMemo, useState } from 'react'
import { X, MapPin } from 'lucide-react'
import regionsData from '../data/regions.json'
import NoticeList from './NoticeList.jsx'

/**
 * App-level shared right-side panel. Triggered by either an InventoryView
 * card click or a KoreaMap region/sub click. Shows the region's sub-entity
 * picker on top and the selected sub-entity's notice list below.
 *
 * Lives INLINE as a flex child of the main content area (NOT a fixed
 * overlay) so it sits beside the inventory grid / map instead of covering
 * them. The parent (App.jsx) controls whether the panel is rendered at
 * all based on `selected`.
 *
 * Closes on:
 *   - ESC key (handled here)
 *   - X button in the header
 */
export default function RegionDetailPanel({
  region,
  initialSub,
  onClose,
  onSelectSub,
}) {
  const subEntities = useMemo(() => {
    if (!region) return null
    const r = regionsData.find(x => x.region === region)
    return r?.subEntities ?? null
  }, [region])

  const [selectedSub, setSelectedSub] = useState(null)

  // Re-sync internal sub selection whenever the trigger updates region or sub.
  useEffect(() => {
    setSelectedSub(initialSub ?? subEntities?.[0]?.name ?? null)
  }, [region, initialSub, subEntities])

  // ESC closes
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handlePick = name => {
    setSelectedSub(name)
    onSelectSub?.(name)
  }

  return (
    <>
      {/* Panel — inline flex child, lives beside the main view */}
      <aside
        style={{
          width: 'min(460px, 100%)',
          flexShrink: 0,
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: 'var(--accent)',
              }}
            >
              <MapPin size={12} /> 선택된 지역
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: 4,
                lineHeight: 1.2,
                wordBreak: 'keep-all',
              }}
            >
              {region ?? '—'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기 (ESC)"
            title="닫기 (ESC)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* Sub-entity picker */}
        <section
          style={{
            padding: '14px 20px 10px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <SectionLabel title="기관" count={subEntities?.length ?? 0} />
          <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(subEntities ?? []).map(s => {
              const active = s.name === selectedSub
              return (
                <button
                  key={s.name}
                  onClick={() => handlePick(s.name)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid ' + (active ? 'var(--accent)' : 'transparent'),
                    background: active ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={e => {
                    if (!active) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {s.sources.length}개 페이지
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Notices */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '14px 20px 20px',
          }}
        >
          <SectionLabel title="최근 공지사항" subtitle={selectedSub ?? undefined} />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 10 }}>
            {region && selectedSub ? (
              <NoticeList region={region} subEntity={selectedSub} />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                기관을 선택하세요
              </div>
            )}
          </div>
        </section>
      </aside>
    </>
  )
}

function SectionLabel({ title, count, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {title}
      </span>
      {count != null && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--accent)',
            background: 'var(--accent-light)',
            padding: '2px 7px',
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
      {subtitle && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          · {subtitle}
        </span>
      )}
    </div>
  )
}
