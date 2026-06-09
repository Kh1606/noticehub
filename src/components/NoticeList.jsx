import { useEffect, useState } from 'react'
import { ExternalLink, Inbox } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { cutoffDateFor, periodConfig } from '../lib/periodFilter.js'
import NoticePlaceholder from './NoticePlaceholder.jsx'

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return iso
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days <= 14) return `${days}일 전`
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function SkeletonCards() {
  return (
    <div
      style={{
        marginTop: 12,
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
            <div className="skeleton" style={{ height: 20, width: 72 }} />
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

function EmptyForPeriod({ period, onChangePeriod }) {
  // Quick-switch shortcuts: prefer the next-longer window, then 전체 as fallback.
  const cfg = periodConfig(period)
  return (
    <div
      style={{
        marginTop: 12,
        padding: '28px 18px',
        textAlign: 'center',
        background: 'var(--bg-page, #F6F8FB)',
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
        <Inbox size={16} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
        최근 <b>{cfg?.label}</b>에 해당하는 공지가 없어요
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        더 길게 보면 표시될 수 있어요.
      </div>
      <div style={{ display: 'inline-flex', gap: 8 }}>
        {period !== '1m' && (
          <button onClick={() => onChangePeriod?.('1m')} style={quickBtn}>
            1개월 보기
          </button>
        )}
        <button onClick={() => onChangePeriod?.('all')} style={quickBtn}>
          전체 보기
        </button>
      </div>
    </div>
  )
}

const quickBtn = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--accent)',
  background: 'var(--bg-card)',
  border: '1px solid var(--accent-light, #DBEAFE)',
  borderRadius: 6,
  cursor: 'pointer',
}

export default function NoticeList({ region, subEntity, period = 'all', onCount, onChangePeriod }) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', items: [], error: null })

    let q = supabase
      .from('notices_v2')
      .select('notice_id,title,detail_url,posted_at,source_page,scraped_at')
      .eq('region', region)
      .eq('sub_entity', subEntity)
    const cutoff = cutoffDateFor(period)
    if (cutoff) q = q.gte('posted_at', cutoff)
    q = q.order('posted_at', { ascending: false, nullsFirst: false }).limit(50)

    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setState({ status: 'error', items: [], error: error.message })
      } else {
        const items = data || []
        setState({ status: 'ok', items, error: null })
        onCount?.(items.length)
      }
    })

    return () => { cancelled = true }
  }, [region, subEntity, period])

  if (state.status === 'loading') return <SkeletonCards />

  if (state.status === 'error') {
    return (
      <div
        style={{
          marginTop: 12,
          padding: 16,
          background: '#FEF2F2',
          color: 'var(--danger)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)',
          fontSize: 13,
        }}
      >
        Supabase 연결 오류: {state.error}
      </div>
    )
  }

  if (state.items.length === 0) {
    // If the user is on 'all' there's genuinely no data — fall back to the
    // existing placeholder. Otherwise show the period-aware empty state
    // with quick-switch buttons.
    if (period === 'all') return <NoticePlaceholder />
    return <EmptyForPeriod period={period} onChangePeriod={onChangePeriod} />
  }

  return (
    <div
      style={{
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 12,
      }}
    >
      {state.items.map(n => {
        const dateStr = formatDate(n.posted_at)
        return (
          <a
            key={n.notice_id}
            href={n.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 14,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 0.15s ease, border-color 0.15s, box-shadow 0.15s',
              textDecoration: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08))'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
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
              {dateStr && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
              }}
            >
              {n.title}
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
              원문 보기 <ExternalLink size={12} />
            </div>
          </a>
        )
      })}
    </div>
  )
}
