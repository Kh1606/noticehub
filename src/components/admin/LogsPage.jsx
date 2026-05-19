import { useEffect, useState, useMemo, useCallback } from 'react'
import { RotateCw, Activity, CheckCircle2, AlertCircle, AlertTriangle, MinusCircle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'

const RUNS_LIMIT = 50

/**
 * /admin/logs — admin view of recent scrape runs + per-source attempt detail.
 *
 * Left column: list of scrape_runs (newest first), realtime-subscribed so a
 *              row's status flips from "running" → "ok|partial|failed" live.
 * Right column: per-source attempts for the selected run, also realtime so
 *              new attempt rows pop in as the scrape progresses.
 */
export default function LogsPage() {
  const [runs, setRuns] = useState(null)
  const [error, setError] = useState(null)
  const [selectedRunId, setSelectedRunId] = useState(null)

  const reloadRuns = useCallback(async () => {
    const { data, error } = await supabase
      .from('scrape_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(RUNS_LIMIT)
    if (error) setError(error.message)
    else {
      setRuns(data || [])
      // Auto-select most recent if nothing selected yet
      if (data?.length && selectedRunId == null) setSelectedRunId(data[0].id)
    }
  }, [selectedRunId])

  useEffect(() => { reloadRuns() }, [reloadRuns])

  // Realtime: any change to scrape_runs → refresh list
  useEffect(() => {
    const channel = supabase
      .channel('scrape_runs_admin')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scrape_runs' },
        () => reloadRuns(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [reloadRuns])

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>실행 로그</h1>
          <p style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13, marginTop: 6 }}>
            최근 {RUNS_LIMIT}개 스크래핑 실행 · 행을 클릭하면 기관별 상세를 볼 수 있어요
          </p>
        </div>
        <button onClick={reloadRuns} style={refreshBtn}>
          <RotateCw size={12} /> 새로고침
        </button>
      </header>

      {error && <div style={errorBox}>{error}</div>}

      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 1fr) minmax(420px, 1.4fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <RunsList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelect={setSelectedRunId}
        />
        <AttemptsPanel runId={selectedRunId} />
      </div>
    </div>
  )
}

function RunsList({ runs, selectedRunId, onSelect }) {
  if (runs === null) {
    return <div style={{ color: 'var(--text-muted, #6B7280)' }}>불러오는 중…</div>
  }
  if (runs.length === 0) {
    return (
      <div style={emptyBox}>
        아직 실행 기록이 없어요. <code>python -m scrapers.run_all --supabase</code> 를 실행하면 여기에 표시됩니다.
      </div>
    )
  }
  return (
    <div style={panelBox}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={theadRow}>
            <th style={{ ...th, width: 24 }}></th>
            <th style={th}>시작 시각</th>
            <th style={{ ...th, width: 70 }}>소스</th>
            <th style={{ ...th, width: 70, textAlign: 'right' }}>공지</th>
            <th style={{ ...th, width: 80 }}>상태</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <RunRow
              key={r.id}
              r={r}
              active={r.id === selectedRunId}
              onClick={() => onSelect(r.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunRow({ r, active, onClick }) {
  const start = new Date(r.started_at)
  const finished = r.finished_at ? new Date(r.finished_at) : null
  const durSec = finished ? Math.round((finished - start) / 1000) : null
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderTop: '1px solid var(--border, #E5E7EB)',
        background: active ? 'var(--accent-light, #EFF6FF)' : 'transparent',
      }}
    >
      <td style={{ ...tdSm, width: 24 }}>
        <StatusIcon status={r.exit_status} />
      </td>
      <td style={tdSm}>
        <div style={{ fontWeight: 600 }}>{start.toLocaleString('ko-KR')}</div>
        <div style={{ color: 'var(--text-muted, #6B7280)', fontSize: 11 }}>
          {r.source_filter ? `filter: ${r.source_filter}` : '전체'}
          {durSec != null && ` · ${durSec}s`}
        </div>
      </td>
      <td style={{ ...tdSm, textAlign: 'left' }}>
        <span style={{ color: '#059669', fontWeight: 600 }}>{r.total_succeeded}</span>
        <span style={{ color: '#9CA3AF', margin: '0 2px' }}>/</span>
        <span style={{ color: r.total_failed ? '#DC2626' : '#9CA3AF', fontWeight: 600 }}>
          {r.total_failed}
        </span>
      </td>
      <td style={{ ...tdSm, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {r.total_notices.toLocaleString()}
      </td>
      <td style={tdSm}>
        <ExitStatusChip status={r.exit_status} />
      </td>
    </tr>
  )
}

function AttemptsPanel({ runId }) {
  const [attempts, setAttempts] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (runId == null) {
      setAttempts(null)
      return
    }
    const { data, error } = await supabase
      .from('scrape_attempts')
      .select('*')
      .eq('run_id', runId)
      .order('started_at', { ascending: true })
    if (error) setError(error.message)
    else setAttempts(data || [])
  }, [runId])

  useEffect(() => { reload() }, [reload])

  // Realtime for the currently-selected run's attempts
  useEffect(() => {
    if (runId == null) return
    const channel = supabase
      .channel(`scrape_attempts_${runId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scrape_attempts', filter: `run_id=eq.${runId}` },
        () => reload(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [runId, reload])

  if (runId == null) {
    return <div style={emptyBox}>좌측에서 실행을 선택하세요.</div>
  }
  if (attempts === null) {
    return <div style={{ color: 'var(--text-muted, #6B7280)' }}>불러오는 중…</div>
  }
  if (error) return <div style={errorBox}>{error}</div>

  return (
    <div style={panelBox}>
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--bg-page, #F9FAFB)',
          borderBottom: '1px solid var(--border, #E5E7EB)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-secondary, #374151)',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        기관별 시도 ({attempts.length}건)
      </div>
      {attempts.length === 0 ? (
        <div style={{ padding: 20, color: 'var(--text-muted, #6B7280)', fontSize: 13 }}>
          아직 기관 기록이 없어요. 곧 표시됩니다…
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={theadRow}>
              <th style={{ ...th, width: 24 }}></th>
              <th style={th}>기관 · 페이지</th>
              <th style={{ ...th, width: 60, textAlign: 'right' }}>공지</th>
              <th style={{ ...th, width: 65, textAlign: 'right' }}>소요</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map(a => <AttemptRow key={a.id} a={a} />)}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AttemptRow({ a }) {
  const isErr = a.status === 'failed'
  const isSkip = a.status === 'skipped'
  return (
    <tr style={{ borderTop: '1px solid var(--border, #E5E7EB)', opacity: isSkip ? 0.55 : 1 }}>
      <td style={{ ...tdSm, width: 24 }}>
        <AttemptStatusIcon status={a.status} />
      </td>
      <td style={tdSm}>
        <div style={{ fontWeight: 600 }}>
          {a.sub_entity || '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
          {a.region || '—'} · {a.source_page || '—'}
        </div>
        {isErr && a.error_text && (
          <div style={{
            marginTop: 4, fontSize: 11, fontFamily: 'monospace',
            color: '#991B1B', wordBreak: 'break-all',
          }}>
            {a.http_status ? `HTTP ${a.http_status} · ` : ''}{a.error_text}
          </div>
        )}
      </td>
      <td style={{ ...tdSm, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {isSkip ? '—' : (a.notice_count ?? 0)}
      </td>
      <td style={{ ...tdSm, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted, #6B7280)' }}>
        {a.duration_ms != null ? formatMs(a.duration_ms) : '—'}
      </td>
    </tr>
  )
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StatusIcon({ status }) {
  if (status === 'running') return <Activity size={14} color="#2563EB" style={{ animation: 'pulse 1.4s infinite' }} />
  if (status === 'ok')      return <CheckCircle2 size={14} color="#059669" />
  if (status === 'partial') return <AlertTriangle size={14} color="#D97706" />
  if (status === 'failed')  return <AlertCircle size={14} color="#DC2626" />
  return <Clock size={14} color="#6B7280" />
}

function AttemptStatusIcon({ status }) {
  if (status === 'ok')      return <CheckCircle2 size={12} color="#059669" />
  if (status === 'failed')  return <AlertCircle size={12} color="#DC2626" />
  if (status === 'skipped') return <MinusCircle size={12} color="#9CA3AF" />
  return null
}

function ExitStatusChip({ status }) {
  const cfg = {
    running: { bg: '#DBEAFE', fg: '#1D4ED8', label: '실행 중' },
    ok:      { bg: '#D1FAE5', fg: '#065F46', label: '성공' },
    partial: { bg: '#FEF3C7', fg: '#92400E', label: '일부 실패' },
    failed:  { bg: '#FEE2E2', fg: '#991B1B', label: '실패' },
  }[status] || { bg: '#E5E7EB', fg: '#374151', label: status }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      background: cfg.bg, color: cfg.fg,
      borderRadius: 999, fontSize: 10, fontWeight: 700,
    }}>{cfg.label}</span>
  )
}

const panelBox = {
  background: 'var(--bg-card, #fff)',
  border: '1px solid var(--border, #E5E7EB)',
  borderRadius: 10,
  overflow: 'hidden',
}

const emptyBox = {
  padding: 28,
  textAlign: 'center',
  background: 'var(--bg-card, #fff)',
  border: '1px solid var(--border, #E5E7EB)',
  borderRadius: 10,
  color: 'var(--text-muted, #6B7280)',
  fontSize: 13,
}

const theadRow = {
  background: 'var(--bg-page, #F9FAFB)',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-muted, #6B7280)',
}

const th = { padding: '8px 10px' }
const tdSm = { padding: '8px 10px', verticalAlign: 'top' }

const refreshBtn = {
  padding: '6px 12px',
  fontSize: 12,
  border: '1px solid var(--border, #E5E7EB)',
  background: 'var(--bg-card, #fff)',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
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
