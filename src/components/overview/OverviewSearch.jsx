// Nationwide notice search for the 개요 view.
//
// This is the page's primary control: one input at the top, when filled
// it swaps the region grid + rail with a flat list of matching notices
// across every region. The panel's existing region-scoped search inside
// RegionDetailPanel is completely untouched.
//
// Implementation note: the period chips here use **local state** (default
// 'all'). They must NOT write to the panel's `clt-notice-period` key —
// sharing it would change the panel's behavior, which is a regression per
// the functionality matrix (F-10).

import { useEffect, useRef, useState } from 'react'
import { Search, X, ExternalLink, SearchX } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { PERIODS, cutoffDateFor, periodConfig } from '../../lib/periodFilter.js'
import { highlight, splitTerms } from '../../lib/searchHighlight.jsx'
import { formatNoticeDate } from '../../lib/format.js'
import { displayRegion } from '../../lib/regionLabels.js'
import OrgIcon from '../OrgIcon.jsx'

// Mirrors NoticeList's behavior: AND across whitespace-split terms via
// .ilike('title', '%t%'), debounce 250ms, limit 50.
export function useOverviewSearch() {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [period, setPeriod] = useState('all')   // local — see file header
  const [state, setState] = useState({ status: 'idle', items: [], error: null })

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250)
    return () => clearTimeout(t)
  }, [term])

  const active = debounced.trim().length > 0

  useEffect(() => {
    if (!active) {
      setState({ status: 'idle', items: [], error: null })
      return
    }
    let cancelled = false
    setState({ status: 'loading', items: [], error: null })

    let q = supabase
      .from('notices_v2')
      .select('notice_id,title,detail_url,posted_at,source_page,region,sub_entity,scraped_at')
    for (const t of splitTerms(debounced)) q = q.ilike('title', `%${t}%`)
    const cutoff = cutoffDateFor(period)
    if (cutoff) q = q.gte('posted_at', cutoff)
    q = q.order('posted_at', { ascending: false, nullsFirst: false }).limit(50)

    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) setState({ status: 'error', items: [], error: error.message })
      else setState({ status: 'ok', items: data || [], error: null })
    })

    return () => { cancelled = true }
  }, [active, debounced, period])

  return {
    term, setTerm,
    debounced,
    period, setPeriod,
    active,
    state,
  }
}

export function OverviewSearchInput({ value, onChange, style }) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        height: 42,
        background: 'var(--bg-card)',
        border: '1px solid ' + (focused ? 'var(--accent)' : 'var(--border)'),
        borderRadius: 'var(--radius-sm)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? '0 0 0 3px var(--focus-ring)' : 'var(--shadow-sm)',
        ...style,
      }}
    >
      <Search size={16} color="var(--text-muted)" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder="전국 공지 검색 — 제목 키워드 (예: 도로, 입찰)"
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => {
          // ESC clears the field; never let it bubble (it could close the
          // notice modal if one happens to be open from a row click).
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        aria-label="전국 공지 검색"
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          color: 'var(--text-primary)',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          aria-label="검색어 지우기"
          title="검색어 지우기"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
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
      type="button"
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
    >
      {label}
    </button>
  )
}

export function OverviewSearchResults({
  debounced,
  state,
  period,
  onChangePeriod,
  onOpenNotice,
  onPickOrg,
}) {
  const terms = splitTerms(debounced)
  const cutoff = cutoffDateFor(period)
  const items = state.items

  return (
    <div style={{ marginTop: 20 }}>
      {/* Results header */}
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            검색 결과 · "{debounced}"
          </h2>
          {state.status === 'ok' && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {items.length}건{items.length === 50 ? '+' : ''} · 최신 50건까지 표시
            </span>
          )}
        </div>
        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <PeriodChip
              key={p.key}
              label={p.label}
              active={p.key === period}
              onClick={() => onChangePeriod(p.key)}
            />
          ))}
        </div>
      </div>
      {cutoff && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {cutoff} ~ {new Date().toISOString().slice(0, 10)}
        </div>
      )}

      {state.status === 'loading' && <SkeletonCards />}

      {state.status === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            padding: 16,
            background: '#FEF2F2',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          검색 중 오류가 발생했어요: {state.error}
        </div>
      )}

      {state.status === 'ok' && items.length === 0 && (
        <div
          style={{
            marginTop: 14,
            padding: '28px 18px',
            textAlign: 'center',
            background: 'var(--bg-page)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-muted)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'var(--bg-card)',
              marginBottom: 8,
              color: 'var(--text-secondary)',
            }}
          >
            <SearchX size={16} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <b>{debounced}</b> 검색 결과가 없어요
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            기간을 넓히거나 짧은 검색어를 시도해보세요.
          </div>
        </div>
      )}

      {state.status === 'ok' && items.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 12,
          }}
        >
          {items.map(n => (
            <ResultCard
              key={n.notice_id}
              n={n}
              terms={terms}
              onOpenNotice={onOpenNotice}
              onPickOrg={onPickOrg}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultCard({ n, terms, onOpenNotice, onPickOrg }) {
  const dateStr = formatNoticeDate(n.posted_at)
  return (
    <button
      type="button"
      onClick={() => onOpenNotice?.(n)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Region chip — muted, click is a no-op (open the org chip
              instead to deep-link into the panel). */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              background: 'var(--bg-page)',
              border: '1px solid var(--border)',
              padding: '2px 7px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
            title={n.region}
          >
            {displayRegion(n.region)}
          </span>
          {n.sub_entity && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation()
                onPickOrg?.(n.region, n.sub_entity)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onPickOrg?.(n.region, n.sub_entity)
                }
              }}
              title={`${n.sub_entity} 패널 열기`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                background: 'var(--bg-page)',
                border: '1px solid var(--border)',
                padding: '2px 7px 2px 4px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <OrgIcon name={n.sub_entity} size={12} />
              {n.sub_entity}
            </span>
          )}
          {n.source_page && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'var(--accent-light)',
                padding: '2px 8px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              {n.source_page}
            </span>
          )}
        </div>
        {dateStr && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {dateStr}
          </span>
        )}
      </div>
      <div
        className="line-clamp-2"
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.4,
          wordBreak: 'keep-all',
        }}
      >
        {highlight(n.title, terms)}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--accent)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 'auto',
        }}
      >
        자세히 보기 <ExternalLink size={12} />
      </div>
    </button>
  )
}

function SkeletonCards() {
  return (
    <div
      style={{
        marginTop: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 12,
      }}
    >
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            padding: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ height: 20, width: 110 }} />
            <div className="skeleton" style={{ height: 16, width: 60 }} />
          </div>
          <div className="skeleton" style={{ height: 14, width: '90%' }} />
          <div className="skeleton" style={{ height: 14, width: '65%' }} />
          <div className="skeleton" style={{ height: 12, width: 56, marginTop: 'auto' }} />
        </div>
      ))}
    </div>
  )
}
