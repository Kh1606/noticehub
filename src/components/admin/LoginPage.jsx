import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'

export default function LoginPage() {
  const { signIn, status, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname || '/admin'

  // If already signed in as an admin, skip the form
  if (status === 'authenticated' && isAdmin) {
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message || 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page, #F6F8FB)',
        padding: 20,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 'min(380px, 100%)',
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: 'var(--radius, 10px)',
          padding: 28,
          boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent, #2563EB)',
              color: '#fff',
            }}
          >
            <LogIn size={16} />
          </span>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>관리자 로그인</h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #6B7280)' }}>
              CLT+ Admin
            </div>
          </div>
        </div>

        <label style={fieldLabel}>이메일</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={fieldInput}
        />

        <label style={{ ...fieldLabel, marginTop: 12 }}>비밀번호</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={fieldInput}
        />

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 10px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#B91C1C',
              fontSize: 12,
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px 14px',
            background: 'var(--accent, #2563EB)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </div>
  )
}

const fieldLabel = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary, #374151)',
  marginBottom: 6,
}

const fieldInput = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border, #E5E7EB)',
  borderRadius: 6,
  fontSize: 14,
  background: 'var(--bg-page, #F9FAFB)',
  outline: 'none',
  boxSizing: 'border-box',
}
