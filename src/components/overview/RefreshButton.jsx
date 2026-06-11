// 새로고침 button + "조회 HH:MM" caption.
//
// When `refreshing` is true the icon spins (CSS @keyframes spin in
// index.css) and the button is disabled. When idle, click → onRefresh().
// The caption underneath is "조회 HH:MM" derived from `fetchedAt`, in
// tabular-nums so it doesn't shift width as the minute changes.

import { RotateCw } from 'lucide-react'
import { formatHM } from '../../lib/format.js'

export default function RefreshButton({ refreshing, fetchedAt, onRefresh }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
      }}
    >
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-busy={refreshing || undefined}
        aria-label="목록 새로고침"
        title="목록 새로고침"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          height: 42,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontWeight: 600,
          cursor: refreshing ? 'default' : 'pointer',
          opacity: refreshing ? 0.7 : 1,
          transition: 'border-color 0.15s, color 0.15s, box-shadow 0.15s',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          if (!refreshing) {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.color = 'var(--accent)'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            transformOrigin: 'center',
          }}
        >
          <RotateCw size={14} />
        </span>
        새로고침
      </button>
      {fetchedAt > 0 && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-num)',
          }}
        >
          조회 {formatHM(fetchedAt)}
        </span>
      )}
    </div>
  )
}
