import { ExternalLink } from 'lucide-react'

export default function SourceCard({ source }) {
  const host = safeHost(source.url)
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
        e.currentTarget.style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {source.page}
        </span>
        <ExternalLink size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          wordBreak: 'break-all',
          lineHeight: 1.4,
        }}
        className="line-clamp-2"
      >
        {host}
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--accent)',
          fontWeight: 600,
          marginTop: 'auto',
        }}
      >
        원문 열기 →
      </div>
    </a>
  )
}

function safeHost(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
