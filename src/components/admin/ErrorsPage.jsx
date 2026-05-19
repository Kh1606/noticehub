import { useEffect, useState, useMemo, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/auth.jsx'

const PAGE_LIMIT = 200

const FILTERS = [
  { key: 'unresolved', label: '미해결' },
  { key: 'all',        label: '전체' },
  { key: '4xx',        label: '4xx' },
  { key: '5xx',        label: '5xx' },
]

export default function ErrorsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('unresolved')
  const [busyId, setBusyId] = useState(null)

  const reload = useCallback(async () => {
    setError(null)
    const { data, error } = await supabase
      .from('scrape_errors')
      .select('id, region, sub_entity, source_page, url_tried, status_code, error_text, occurred_at, resolved_at, resolved_by')
      .order('occurred_at', { ascending: false })
      .limit(PAGE_LIMIT)
    if (error) {
      setError(error.message)
      setRows([])
      return
    }
    setRows(data || [])
  }, [])

  useEffect(() => { reload() }, [reload])

  // Live update: refresh the list when new errors land.
  useEffect(() => {
    const channel = supabase
      .channel('scrape_errors_page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scrape_errors' },
        () => reload(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [reload])

  const filtered = useMemo(() => {
    if (!rows) return null
    return rows.filter(r => {
      if (filter === 'unresolved') return !r.resolved_at
      if (filter === '4xx') return r.status_code >= 400 && r.status_code < 500
      if (filter === '5xx') return r.status_code >= 500 && r.status_code < 600
      return true
    })
  }, [rows, filter])

  const counts = useMemo(() => {
    if (!rows) return { unresolved: 0, all: 0, _4xx: 0, _5xx: 0 }
    let unresolved = 0, _4xx = 0, _5xx = 0
    for (const r of rows) {
      if (!r.resolved_at) unresolved++
      if (r.status_code >= 400 && r.status_code < 500) _4xx++
      if (r.status_code >= 500 && r.status_code < 600) _5xx++
    }
    return { unresolved, all: rows.length, _4xx, _5xx }
  }, [rows])

  const resolve = async (row) => {
    setBusyId(row.id)
    const { error } = await supabase
      .from('scrape_errors')
      .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('id', row.id)
    if (error) setError(error.message)
    else await reload()
    setBusyId(null)
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>스크래퍼 오류</h1>
          <p style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13, marginTop: 6 }}>
            4xx · 5xx 응답을 기록합니다. 미해결 <b>{counts.unresolved}</b>건 · 전체 {counts.all}건
          </p>
        </div>
        <button
          onClick={reload}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            border: '1px solid var(--border, #E5E7EB)',
            background: 'var(--bg-card, #fff)',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <RotateCw size={12} /> 새로고침
        </button>
      </header>

      {/* Filter chips */}
      <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          const count = f.key === 'all' ? counts.all
                      : f.key === '4xx' ? counts._4xx
                      : f.key === '5xx' ? counts._5xx
                      : counts.unresolved
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid ' + (active ? '#DC2626' : 'var(--border, #E5E7EB)'),
                background: active ? '#FEE2E2' : 'var(--bg-card, #fff)',
                color: active ? '#991B1B' : 'var(--text-secondary, #374151)',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {f.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>· {count}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <div style={errorBox}>{error}</div>
      )}

      {filtered === null ? (
        <div style={{ marginTop: 20, color: 'var(--text-muted, #6B7280)' }}>불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div style={{ marginTop: 20, padding: 28, textAlign: 'center', background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 10, color: 'var(--text-muted, #6B7280)' }}>
          기록된 오류가 없어요.
        </div>
      ) : (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={theadRow}>
                <th style={{ ...th, width: 140 }}>시간</th>
                <th style={{ ...th, width: 90 }}>상태</th>
                <th style={{ ...th, width: 100 }}>지역</th>
                <th style={{ ...th, width: 180 }}>기관</th>
                <th style={th}>URL · 메시지</th>
                <th style={{ ...th, width: 100, textAlign: 'right' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <ErrorRow key={r.id} r={r} busy={busyId === r.id} onResolve={() => resolve(r)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ErrorRow({ r, busy, onResolve }) {
  const resolved = !!r.resolved_at
  const muted = { color: 'var(--text-muted, #6B7280)' }
  return (
    <tr style={{ borderTop: '1px solid var(--border, #E5E7EB)', opacity: resolved ? 0.6 : 1 }}>
      <td style={td}>
        <div style={resolved ? muted : {}}>
          {new Date(r.occurred_at).toLocaleString('ko-KR')}
        </div>
      </td>
      <td style={td}>
        <StatusBadge code={r.status_code} resolved={resolved} />
      </td>
      <td style={td}>{r.region || '—'}</td>
      <td style={{ ...td, fontWeight: 600 }}>{r.sub_entity || '—'}</td>
      <td style={td}>
        <a
          href={r.url_tried}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: resolved ? 'var(--text-muted, #6B7280)' : 'var(--accent, #2563EB)',
            wordBreak: 'break-all',
            textDecoration: 'none',
          }}
        >
          {r.url_tried}
        </a>
        {r.error_text && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted, #6B7280)', fontFamily: 'monospace' }}>
            {r.error_text}
          </div>
        )}
      </td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {resolved ? (
          <span style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> 해결됨
          </span>
        ) : (
          <button onClick={onResolve} disabled={busy} style={resolveBtn}>
            {busy ? '…' : '해결'}
          </button>
        )}
      </td>
    </tr>
  )
}

function StatusBadge({ code, resolved }) {
  const is4xx = code >= 400 && code < 500
  const is5xx = code >= 500 && code < 600
  const bg = resolved ? '#F3F4F6' : is4xx ? '#FEE2E2' : is5xx ? '#FEF3C7' : '#E5E7EB'
  const fg = resolved ? '#6B7280' : is4xx ? '#991B1B' : is5xx ? '#92400E' : '#374151'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: bg,
        color: fg,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {!resolved && <AlertTriangle size={10} />}
      {code || '—'}
    </span>
  )
}

const tableWrap = {
  marginTop: 18,
  background: 'var(--bg-card, #fff)',
  border: '1px solid var(--border, #E5E7EB)',
  borderRadius: 10,
  overflow: 'hidden',
}

const theadRow = {
  background: 'var(--bg-page, #F9FAFB)',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-muted, #6B7280)',
}

const th = { padding: '10px 14px' }
const td = { padding: '10px 14px', verticalAlign: 'top' }

const resolveBtn = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid #DC2626',
  background: '#DC2626',
  color: '#fff',
  borderRadius: 6,
  cursor: 'pointer',
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
