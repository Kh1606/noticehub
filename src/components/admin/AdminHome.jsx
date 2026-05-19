import { Link } from 'react-router-dom'
import { Database, History, AlertTriangle, Activity } from 'lucide-react'

export default function AdminHome() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>관리자 홈</h1>
      <p style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13, marginTop: 6 }}>
        스크래퍼 엔드포인트를 코드 수정 없이 관리할 수 있어요.
      </p>

      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        <Card to="/admin/sources" icon={<Database size={18} />} title="소스 관리">
          기관별 스크래퍼 URL을 보고, 변경하고, 되돌릴 수 있어요.
        </Card>
        <Card to="/admin/history" icon={<History size={18} />} title="변경 이력">
          누가 언제 어떤 URL을 바꿨는지 시간 순으로 볼 수 있어요.
        </Card>
        <Card to="/admin/logs" icon={<Activity size={18} />} title="실행 로그">
          최근 스크래핑 실행 내역과 기관별 상세를 실시간으로 볼 수 있어요.
        </Card>
        <Card to="/admin/errors" icon={<AlertTriangle size={18} />} title="오류 로그">
          스크래퍼가 4xx · 5xx 응답을 받은 기록입니다. 새 오류는 화면 오른쪽 위에 토스트로도 표시됩니다.
        </Card>
      </div>
    </div>
  )
}

function Card({ to, icon, title, children }) {
  return (
    <Link
      to={to}
      style={{
        display: 'block',
        padding: 18,
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border, #E5E7EB)',
        borderRadius: 10,
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--accent-light, #EFF6FF)',
            color: 'var(--accent, #2563EB)',
          }}
        >
          {icon}
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary, #374151)', marginTop: 10 }}>
        {children}
      </p>
    </Link>
  )
}
