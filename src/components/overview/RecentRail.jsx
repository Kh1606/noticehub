// 최근 공지 rail — 15 most-recent notices nationwide, shown to the right
// of the region grid on wide viewports. Each row opens the same
// NoticeDetailModal the search results use; the org chip deep-links into
// the panel (App.pickSub).
//
// This is a small independent query (limit 15) — not routed through the
// inventory store because the store is keyed on the per-region rollup, not
// individual rows. Cheap query, runs whenever the parent bumps
// `refreshToken` (the 새로고침 button).

import { useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { formatNoticeDate } from '../../lib/format.js'
import { displayRegion } from '../../lib/regionLabels.js'
import OrgIcon from '../OrgIcon.jsx'

const LIMIT = 15

export default function RecentRail({ onOpenNotice, onPickOrg, refreshToken }) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null })

  useEffect(() => {
    let cancelled = false
    setState(prev => prev.items.length
      ? { ...prev, status: 'loading' }     // keep items shown while refetching
      : { status: 'loading', items: [], error: null })

    supabase
      .from('notices_v2')
      .select('notice_id,title,detail_url,posted_at,source_page,region,sub_entity,scraped_at')
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setState({ status: 'error', items: [], error: error.message })
        else setState({ status: 'ok', items: data || [], error: null })
      })

    return () => { cancelled = true }
  }, [refreshToken])

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 0,
        maxHeight: 'calc(100vh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '12px 14px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          최근 공지
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          전국 · 최신 {LIMIT}건
        </span>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {state.status === 'loading' && state.items.length === 0 && (
          <SkeletonRows />
        )}

        {state.status === 'error' && (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            최근 공지를 불러오지 못했어요.
            <div>
              <button
                type="button"
                onClick={() => setState({ status: 'loading', items: [], error: null })}
                style={{
                  marginTop: 8,
                  padding: '5px 10px',
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
        )}

        {state.status === 'ok' && state.items.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
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
                background: 'var(--bg-page)',
                marginBottom: 8,
                color: 'var(--text-secondary)',
              }}
            >
              <Inbox size={16} />
            </div>
            <div>최근 공지가 없습니다</div>
          </div>
        )}

        {state.items.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {state.items.map((n, idx) => (
              <li
                key={n.notice_id}
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <RecentRow
                  n={n}
                  onOpenNotice={onOpenNotice}
                  onPickOrg={onPickOrg}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function RecentRow({ n, onOpenNotice, onPickOrg }) {
  const dateStr = formatNoticeDate(n.posted_at)
  return (
    <button
      type="button"
      onClick={() => onOpenNotice?.(n)}
      title={n.title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: '100%',
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 0.15s',
        font: 'inherit',
        color: 'inherit',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                color: 'var(--accent)',
                background: 'var(--accent-light)',
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
                fontSize: 10,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
              title={displayRegion(n.region)}
            >
              {n.source_page}
            </span>
          )}
        </div>
        {dateStr && (
          <span
            style={{
              fontSize: 10,
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
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.35,
          wordBreak: 'keep-all',
        }}
      >
        {n.title}
      </div>
    </button>
  )
}

function SkeletonRows() {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {[0, 1, 2, 3, 4, 5].map((_, i) => (
        <li
          key={i}
          style={{
            padding: '10px 14px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ height: 14, width: 80 }} />
            <div className="skeleton" style={{ height: 12, width: 40 }} />
          </div>
          <div className="skeleton" style={{ height: 13, width: '95%' }} />
          <div className="skeleton" style={{ height: 13, width: '70%' }} />
        </li>
      ))}
    </ul>
  )
}
