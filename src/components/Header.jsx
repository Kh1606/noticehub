import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import ModeToggle from './ModeToggle.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function Header({ viewMode, setViewMode }) {
  const { isAdmin } = useAuth()
  return (
    <header
      style={{
        background: 'var(--sidebar-bg)',
        color: '#fff',
        padding: '14px 24px',
        boxShadow: 'var(--shadow-sm)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--accent-cyan)',
            color: 'var(--sidebar-bg)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          C+
        </span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>
            CLT+
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            공공기관 공지사항 통합 뷰어
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {setViewMode && (
            <ModeToggle viewMode={viewMode} setViewMode={setViewMode} />
          )}
          {isAdmin && (
            <Link
              to="/admin"
              title="관리자"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              <Shield size={12} /> Admin
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
