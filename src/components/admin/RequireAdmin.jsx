import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'

export default function RequireAdmin({ children }) {
  const { user, status, isAdmin, signOut } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div style={centered}>
        <div style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13 }}>
          확인 중…
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return (
      <div style={centered}>
        <div
          style={{
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border, #E5E7EB)',
            borderRadius: 10,
            padding: 28,
            width: 'min(380px, 100%)',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            권한이 없습니다
          </h1>
          <p style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13, marginTop: 8 }}>
            관리자 계정으로만 접근할 수 있어요.<br />
            ({user.email})
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button onClick={signOut} style={ghostBtn}>로그아웃</button>
            <Link to="/" style={{ ...ghostBtn, textDecoration: 'none' }}>
              사이트로
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return children
}

const centered = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-page, #F6F8FB)',
  padding: 20,
}

const ghostBtn = {
  padding: '8px 14px',
  background: 'var(--bg-hover, #F3F4F6)',
  color: 'var(--text-primary, #111827)',
  border: '1px solid var(--border, #E5E7EB)',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}
