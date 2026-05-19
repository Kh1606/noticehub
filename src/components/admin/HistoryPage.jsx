import { useEffect, useState, useMemo } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'

const PAGE_SIZE = 200

export default function HistoryPage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('source_override_history')
        .select('id, region, sub_entity, source_page, old_url, new_url, action, changed_by, changed_email, changed_at')
        .order('changed_at', { ascending: false })
        .limit(PAGE_SIZE)
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setRows(data || [])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => (
      (r.region || '').toLowerCase().includes(q) ||
      (r.sub_entity || '').toLowerCase().includes(q) ||
      (r.source_page || '').toLowerCase().includes(q) ||
      (r.changed_email || '').toLowerCase().includes(q) ||
      (r.new_url || '').toLowerCase().includes(q) ||
      (r.old_url || '').toLowerCase().includes(q)
    ))
  }, [rows, filter])

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>변경 이력</h1>
          <p style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13, marginTop: 6 }}>
            최근 {PAGE_SIZE}개의 엔드포인트 변경 기록입니다.
          </p>
        </div>
        <input
          placeholder="검색: 기관, 사용자, URL"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border, #E5E7EB)',
            borderRadius: 6,
            fontSize: 13,
            minWidth: 240,
          }}
        />
      </header>

      {error && (
        <div style={errorBox}>{error}</div>
      )}

      {filtered === null ? (
        <div style={{ marginTop: 20, color: 'var(--text-muted, #6B7280)' }}>불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div style={{ marginTop: 20, padding: 28, textAlign: 'center', background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 10, color: 'var(--text-muted, #6B7280)' }}>
          아직 변경 기록이 없어요.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => <HistoryRow key={r.id} r={r} />)}
        </ul>
      )}
    </div>
  )
}

function HistoryRow({ r }) {
  const ts = new Date(r.changed_at)
  return (
    <li
      style={{
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border, #E5E7EB)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <ActionBadge action={r.action} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {r.region} · {r.sub_entity}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #6B7280)' }}>
            {r.source_page}
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {r.action === 'update' && (
            <>
              <span style={{ color: '#9CA3AF', textDecoration: 'line-through' }}>{r.old_url}</span>
              <span style={{ margin: '0 6px', color: '#9CA3AF' }}>→</span>
              <span style={{ color: 'var(--text-primary, #111827)' }}>{r.new_url}</span>
            </>
          )}
          {r.action === 'insert' && (
            <span style={{ color: 'var(--text-primary, #111827)' }}>{r.new_url}</span>
          )}
          {r.action === 'delete' && (
            <span style={{ color: '#9CA3AF', textDecoration: 'line-through' }}>{r.old_url}</span>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
          {r.changed_email || '(unknown)'} · {ts.toLocaleString('ko-KR')}
        </div>
      </div>
    </li>
  )
}

function ActionBadge({ action }) {
  const cfg = {
    insert: { bg: '#D1FAE5', fg: '#065F46', label: '추가', Icon: Plus },
    update: { bg: '#DBEAFE', fg: '#1D4ED8', label: '수정', Icon: Pencil },
    delete: { bg: '#FEE2E2', fg: '#991B1B', label: '되돌림', Icon: Trash2 },
  }[action] || { bg: '#E5E7EB', fg: '#374151', label: action, Icon: Pencil }
  const { Icon } = cfg
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: cfg.bg,
        color: cfg.fg,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      <Icon size={11} /> {cfg.label}
    </span>
  )
}

const errorBox = {
  marginTop: 14,
  padding: '8px 12px',
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  color: '#B91C1C',
  fontSize: 12,
  borderRadius: 6,
}
