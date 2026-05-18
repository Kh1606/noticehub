import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days <= 14) return `${days}일 전`
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function RecentFeed({ onSelect }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('notices_v2')
      .select('notice_id,title,detail_url,posted_at,source_page,region,sub_entity')
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(24)
      .then(({ data }) => {
        setItems(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          최근 공지사항
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          전국 공공기관에서 최근 수집된 공지사항입니다. 왼쪽에서 기관을 선택하면 해당 기관만 볼 수 있습니다.
        </p>
      </div>

      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {[...Array(12)].map((_, i) => (
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
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="skeleton" style={{ height: 20, width: 60 }} />
                <div className="skeleton" style={{ height: 20, width: 80 }} />
              </div>
              <div className="skeleton" style={{ height: 14, width: '85%' }} />
              <div className="skeleton" style={{ height: 14, width: '55%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {items.map(n => (
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
                transition: 'transform 0.15s ease, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  onClick={e => {
                    e.preventDefault()
                    onSelect?.({ region: n.region, sub: n.sub_entity })
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    background: 'var(--accent-light)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {n.sub_entity}
                </button>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    background: 'var(--bg-hover)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {n.source_page}
                </span>
                {formatDate(n.posted_at) && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {formatDate(n.posted_at)}
                  </span>
                )}
              </div>
              <div
                className="line-clamp-2"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  lineHeight: 1.45,
                }}
              >
                {n.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 'auto',
                }}
              >
                원문 보기 <ExternalLink size={11} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
