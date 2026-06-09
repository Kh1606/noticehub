import { useEffect, useMemo, useState, useCallback } from 'react'
import { X, MapPin, Search } from 'lucide-react'
import regionsData from '../data/regions.json'
import NoticeList from './NoticeList.jsx'
import useRegionInventory from './useRegionInventory.js'
import {
  PERIODS,
  readStoredPeriod,
  writeStoredPeriod,
  dateRangeLabel,
  periodConfig,
} from '../lib/periodFilter.js'

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

  const inv = useRegionInventory()
  const countsBySub = useMemo(() => {
    if (!region) return {}
    const r = inv.byRegion.find(x => x.region === region)
    if (!r) return {}
    const m = {}
    for (const e of r.byEntity) m[e.name] = e.count
    return m
  }, [inv.byRegion, region])

  const [selectedSub, setSelectedSub] = useState(null)

  // Period filter (1d / 3d / 1w / 1m / all) — persists across regions and
  // browser reloads via localStorage.
  const [period, setPeriod] = useState(readStoredPeriod)
  const updatePeriod = useCallback((key) => {
    setPeriod(key)
    writeStoredPeriod(key)
  }, [])

  // Keyword search — debounced. Live input value vs the term that actually
  // hits the DB query (debounced 250ms).
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => clearTimeout(t)
  }, [searchTerm])
  // Reset the search when the region changes — searching in 경기도 should
  // not leak over when the user jumps to 충청남도.
  useEffect(() => { setSearchTerm('') }, [region])
  const isSearching = debouncedSearch.trim().length > 0

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
          padding: '16px 20px 12px',
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

      {/* Search bar — keyword search across the entire region */}
      <section
        style={{
          padding: '10px 20px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={`${region ?? ''} 전체에서 검색…`}
        />
      </section>

      {/* Sub-entity chips — hidden during search since results span all orgs */}
      {!isSearching && (
      <section
        style={{
          padding: '12px 20px 12px',
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
      )}

      {/* Notices — with period filter */}
      <section
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 20px 18px',
        }}
      >
        <SectionLabel
          title={isSearching ? '검색 결과' : '최근 공지사항'}
          subtitle={
            isSearching
              ? `${periodConfig(period)?.label} · ${region} 전체`
              : selectedSub
                ? `${periodConfig(period)?.label} · ${selectedSub}`
                : periodConfig(period)?.label
          }
        />

        {/* Period chip group */}
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {PERIODS.map(p => (
            <PeriodChip
              key={p.key}
              label={p.label}
              active={p.key === period}
              onClick={() => updatePeriod(p.key)}
            />
          ))}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {dateRangeLabel(period)}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          {region && (selectedSub || isSearching) ? (
            <NoticeList
              region={region}
              subEntity={selectedSub}
              period={period}
              searchTerm={debouncedSearch}
              onChangePeriod={updatePeriod}
            />
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

function SearchBar({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 38,
        background: 'var(--bg-card)',
        border: '1px solid ' + (focused ? 'var(--accent)' : 'var(--border)'),
        borderRadius: 8,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
      }}
    >
      <Search size={14} color="var(--text-muted)" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => {
          // ESC inside the input clears it; don't bubble to the panel-close handler
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--text-primary)',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
          title="검색어 지우기"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 999,
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

function PeriodChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: active ? 'var(--accent)' : 'var(--bg-card)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-hover, #F3F4F6)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-card)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }
      }}
    >
      {label}
    </button>
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
