import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, X } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'

// Auto-dismiss after this long; click X to dismiss earlier
const AUTO_DISMISS_MS = 8000
const MAX_ALERTS = 5

/**
 * Floating red alert stack — subscribes to scrape_errors INSERT events via
 * Supabase Realtime. Each new row pops a banner in the top-right of the
 * admin UI. Visually distinct (red, bell icon, "스크래퍼 오류" label) from
 * any blue/accent UI element.
 *
 * Mounted from AdminLayout, so it only renders for authenticated admins.
 */
export default function ScrapeErrorAlerts() {
  const [alerts, setAlerts] = useState([])

  const dismiss = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('scrape_errors_insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scrape_errors' },
        (payload) => {
          const row = payload.new
          setAlerts(prev => {
            const next = [{ ...row, _seen_at: Date.now() }, ...prev]
            return next.slice(0, MAX_ALERTS)
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Auto-dismiss timers
  useEffect(() => {
    if (alerts.length === 0) return
    const timers = alerts.map(a => {
      const remaining = AUTO_DISMISS_MS - (Date.now() - a._seen_at)
      return setTimeout(() => dismiss(a.id), Math.max(remaining, 0))
    })
    return () => timers.forEach(clearTimeout)
  }, [alerts, dismiss])

  if (alerts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {alerts.map(a => (
        <Banner key={a.id} alert={a} onDismiss={() => dismiss(a.id)} />
      ))}
    </div>
  )
}

function Banner({ alert, onDismiss }) {
  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'auto',
        width: 360,
        background: '#FEF2F2',
        border: '1px solid #FCA5A5',
        borderLeft: '4px solid #DC2626',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(220, 38, 38, 0.18)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        animation: 'slideInRight 0.18s ease-out',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 6,
          background: '#DC2626',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertOctagon size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: '#B91C1C',
            textTransform: 'uppercase',
          }}
        >
          스크래퍼 오류 · HTTP {alert.status_code || '—'}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#7F1D1D', marginTop: 2 }}>
          {alert.sub_entity || '(unknown)'} · {alert.source_page || '—'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#991B1B',
            marginTop: 4,
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            maxHeight: 36,
            overflow: 'hidden',
          }}
        >
          {alert.url_tried}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            to="/admin/errors"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#B91C1C',
              textDecoration: 'underline',
            }}
          >
            전체 보기 →
          </Link>
          <span style={{ fontSize: 11, color: '#991B1B' }}>
            {new Date(alert.occurred_at).toLocaleTimeString('ko-KR')}
          </span>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="닫기"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: '#B91C1C',
          cursor: 'pointer',
          padding: 2,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
