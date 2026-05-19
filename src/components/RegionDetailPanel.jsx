import { useEffect, useMemo, useState } from 'react'
import { X, MapPin } from 'lucide-react'
import regionsData from '../data/regions.json'
import NoticeList from './NoticeList.jsx'
import useRegionInventory from './useRegionInventory.js'

/**
 * App-level shared right-side panel. Triggered by either an InventoryView
 * card click or a KoreaMap region/sub click. Shows:
 *   - region name + close button
 *   - all sub-entities for the region as clickable chips (with notice
 *     counts pulled from useRegionInventory); selected chip is orange
 *   - the selected sub-entity's recent notices
 *
 * Lives INLINE as a flex child of the main content area (NOT a fixed
 * overlay) — sits beside the inventory grid or map.
 *
 * Closes on:
 *   - ESC key
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

  const inv = useRegionInventory(30)
  const countsBySub = useMemo(() => {
    if (!region) return {}
    const r = inv.byRegion.find(x => x.region === region)
    if (!r) return {}
    const m = {}
    for (const e of r.byEntity) m[e.name] = e.count
    return m
  }, [inv.byRegion, region])

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

  // Sort: highest-count orgs first, then 0-count alphabetically.
  const sortedChips = useMemo(() => {
    if (!subEntities) return []
    return [...subEntities]
      .map(s => ({ name: s.name, count: countsBySub[s.name] || 0 }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.name.localeCompare(b.name, 'ko')
      })
  }, [subEntities, countsBySub])

  const activeOrgs = sortedChips.filter(c => c.count > 0).length

  return (
    <aside
      style={{
        width: 'min(540px, 100%)',
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
          padding: '18px 22px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          flexShrink: 0,
          background: 'linear-gradient(180deg, #F5F9FF 0%, var(--bg-card) 100%)',
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
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            기관 {sortedChips.length}개 · 활성 {activeOrgs}개
          </div>
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

      {/* Sub-entity chips */}
      <section
        style={{
          padding: '14px 22px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          maxHeight: 260,
          overflowY: 'auto',
        }}
      >
        <SectionLabel title={`${region ?? ''} 기관`} />
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {sortedChips.map(({ name, count }) => (
            <OrgChip
              key={name}
              name={name}
              count={count}
              active={name === selectedSub}
              loading={inv.status === 'loading'}
              onClick={() => handlePick(name)}
            />
          ))}
        </div>
      </section>

      {/* Notices */}
      <section
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '14px 22px 20px',
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
  )
}

function OrgChip({ name, count, active, loading, onClick }) {
  const hasNotices = count > 0
  // Active: orange (matches the map's selected sub-region color).
  // Has notices: subtle accent border + accent count badge.
  // No notices: muted gray.
  const styles = active
    ? {
        background: '#F97316',
        color: '#fff',
        border: '1px solid #C2410C',
      }
    : hasNotices
    ? {
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--accent-light)',
      }
    : {
        background: 'var(--bg-hover)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }

  return (
    <button
      onClick={onClick}
      title={`${name} · ${count}건`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'transform 0.12s, background 0.15s, color 0.15s, border-color 0.15s',
        whiteSpace: 'nowrap',
        ...styles,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.transform = 'translateY(-1px)'
          if (hasNotices) e.currentTarget.style.background = 'var(--accent-light)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.background = hasNotices ? 'var(--bg-card)' : 'var(--bg-hover)'
        }
      }}
    >
      <span>{name}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '1px 7px',
          borderRadius: 999,
          background: active
            ? 'rgba(255,255,255,0.25)'
            : hasNotices
            ? 'var(--accent-light)'
            : 'transparent',
          color: active
            ? '#fff'
            : hasNotices
            ? 'var(--accent)'
            : 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 18,
          textAlign: 'center',
        }}
      >
        {loading && count === 0 ? '…' : count}
      </span>
    </button>
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
