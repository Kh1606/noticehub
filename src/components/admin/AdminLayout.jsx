import { useEffect, useState, useCallback } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { LogOut, Shield, Database, History, Home, AlertTriangle, Activity, RefreshCw } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'
import { supabase } from '../../lib/supabase.js'
import ScrapeErrorAlerts from './ScrapeErrorAlerts.jsx'

export default function AdminLayout() {
  const { user, signOut, forceReset } = useAuth()
  const [unresolvedCount, setUnresolvedCount] = useState(0)

  const refreshCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('scrape_errors')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null)
    if (!error) setUnresolvedCount(count || 0)
  }, [])

  // Initial count + live updates
  useEffect(() => {
    refreshCount()
    const channel = supabase
      .channel('scrape_errors_count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scrape_errors' },
        () => refreshCount(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refreshCount])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page, #F6F8FB)' }}>
      <ScrapeErrorAlerts />

      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--sidebar-bg, #0F172A)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 14px',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 14px' }}>
          <Shield size={18} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>CLT+ Admin</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{user?.email}</div>
          </div>
        </div>

        <NavItem to="/admin" end icon={<Home size={14} />}>홈</NavItem>
        <NavItem to="/admin/sources" icon={<Database size={14} />}>소스 관리</NavItem>
        <NavItem to="/admin/history" icon={<History size={14} />}>변경 이력</NavItem>
        <NavItem to="/admin/logs" icon={<Activity size={14} />}>실행 로그</NavItem>
        <NavItem
          to="/admin/errors"
          icon={<AlertTriangle size={14} />}
          badge={unresolvedCount}
        >
          오류 로그
        </NavItem>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={forceReset}
            title="페이지가 멈췄을 때 클릭하면 세션을 비우고 새로고침합니다"
            style={{ ...navLinkStyle(false), border: 'none', textAlign: 'left' }}
          >
            <RefreshCw size={14} /> 세션 초기화
          </button>
          <Link to="/" style={navLinkStyle(false)}>
            <span style={{ width: 14, display: 'inline-flex' }}>←</span> 사이트로
          </Link>
          <button onClick={signOut} style={{ ...navLinkStyle(false), border: 'none', textAlign: 'left' }}>
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: '24px 32px', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, end, icon, badge, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({ ...navLinkStyle(isActive), justifyContent: 'space-between' })}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span>{children}</span>
      </span>
      {badge > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 999,
            background: '#DC2626',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function navLinkStyle(active) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    color: active ? '#fff' : 'rgba(255,255,255,0.75)',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    textDecoration: 'none',
    cursor: 'pointer',
  }
}
