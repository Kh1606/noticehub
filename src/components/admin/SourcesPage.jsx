import { useEffect, useMemo, useState, useCallback } from 'react'
import { Edit2, Check, X, RotateCcw } from 'lucide-react'
import regionsData from '../../data/regions.json'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/auth.jsx'

// Flatten regions.json into one row per (region, sub_entity, source_page) with
// the hardcoded default URL. This is the canonical universe — overrides layer on top.
function flattenDefaults() {
  const rows = []
  for (const r of regionsData) {
    for (const sub of r.subEntities || []) {
      for (const s of sub.sources || []) {
        rows.push({
          region: r.region,
          sub_entity: sub.name,
          source_page: s.page || '',
          default_url: s.url || '',
          crawlable: s.crawlable !== false,
        })
      }
    }
  }
  return rows
}

const DEFAULTS = flattenDefaults()

export default function SourcesPage() {
  const { user } = useAuth()
  const [overrides, setOverrides] = useState({}) // key = `${region}|${sub_entity}|${source_page}`
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [showOnlyOverridden, setShowOnlyOverridden] = useState(false)
  const [editing, setEditing] = useState(null) // key being edited
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('source_overrides')
      .select('region, sub_entity, source_page, new_url, changed_at, changed_by')
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const map = {}
    for (const o of data || []) {
      map[`${o.region}|${o.sub_entity}|${o.source_page}`] = o
    }
    setOverrides(map)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return DEFAULTS
      .map(d => {
        const key = `${d.region}|${d.sub_entity}|${d.source_page}`
        const ov = overrides[key]
        return { ...d, key, override: ov, effective_url: ov?.new_url || d.default_url }
      })
      .filter(r => {
        if (showOnlyOverridden && !r.override) return false
        if (!q) return true
        return (
          r.region.toLowerCase().includes(q) ||
          r.sub_entity.toLowerCase().includes(q) ||
          r.source_page.toLowerCase().includes(q) ||
          r.default_url.toLowerCase().includes(q)
        )
      })
  }, [overrides, filter, showOnlyOverridden])

  const startEdit = (r) => {
    setEditing(r.key)
    setEditValue(r.effective_url)
  }
  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  const saveEdit = async (r) => {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setError('URL은 비어 있을 수 없어요.')
      return
    }
    if (trimmed === r.default_url) {
      // Setting back to default = same as revert
      await revert(r)
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('source_overrides')
      .upsert({
        region: r.region,
        sub_entity: r.sub_entity,
        source_page: r.source_page,
        new_url: trimmed,
        changed_by: user.id,
        changed_at: new Date().toISOString(),
      }, { onConflict: 'region,sub_entity,source_page' })
    if (error) {
      setError(error.message)
    } else {
      cancelEdit()
      await reload()
    }
    setBusy(false)
  }

  const revert = async (r) => {
    if (!r.override) return
    if (!confirm(`${r.sub_entity} / ${r.source_page} 의 변경을 되돌릴까요?\n기본 URL로 복귀합니다.`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('source_overrides')
      .delete()
      .eq('region', r.region)
      .eq('sub_entity', r.sub_entity)
      .eq('source_page', r.source_page)
    if (error) {
      setError(error.message)
    } else {
      cancelEdit()
      await reload()
    }
    setBusy(false)
  }

  const overriddenCount = Object.keys(overrides).length

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>소스 관리</h1>
          <p style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13, marginTop: 6 }}>
            전체 {DEFAULTS.length}개 소스 · 변경됨 <b>{overriddenCount}</b>개
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            placeholder="지역, 기관, URL 검색"
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
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #374151)' }}>
            <input
              type="checkbox"
              checked={showOnlyOverridden}
              onChange={(e) => setShowOnlyOverridden(e.target.checked)}
            />
            변경된 것만
          </label>
        </div>
      </header>

      {error && (
        <div style={errorBox}>{error}</div>
      )}

      {loading ? (
        <div style={{ marginTop: 20, color: 'var(--text-muted, #6B7280)' }}>불러오는 중…</div>
      ) : (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={theadRow}>
                <th style={{ ...th, width: 100 }}>지역</th>
                <th style={{ ...th, width: 180 }}>기관</th>
                <th style={{ ...th, width: 120 }}>페이지</th>
                <th style={th}>적용 URL</th>
                <th style={{ ...th, width: 100, textAlign: 'right' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted, #6B7280)' }}>
                  일치하는 소스가 없어요
                </td></tr>
              )}
              {rows.map(r => {
                const isEditing = editing === r.key
                const isOverridden = !!r.override
                return (
                  <tr key={r.key} style={{ borderTop: '1px solid var(--border, #E5E7EB)' }}>
                    <td style={td}>{r.region}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.sub_entity}</td>
                    <td style={td}>{r.source_page || '—'}</td>
                    <td style={td}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(r)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid var(--accent, #2563EB)',
                            borderRadius: 4,
                            fontSize: 12,
                            fontFamily: 'monospace',
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <a
                            href={r.effective_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: isOverridden ? 'var(--accent, #2563EB)' : 'var(--text-secondary, #374151)',
                              textDecoration: 'none',
                              wordBreak: 'break-all',
                            }}
                          >
                            {r.effective_url}
                          </a>
                          {isOverridden && (
                            <span style={overriddenBadge} title={`기본값: ${r.default_url}`}>
                              변경됨
                            </span>
                          )}
                          {!r.crawlable && (
                            <span style={{ ...overriddenBadge, background: '#FEF3C7', color: '#92400E' }}>
                              비크롤
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(r)} disabled={busy} style={iconBtn} title="저장">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit} disabled={busy} style={iconBtn} title="취소">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} style={iconBtn} title="편집">
                            <Edit2 size={14} />
                          </button>
                          {isOverridden && (
                            <button onClick={() => revert(r)} disabled={busy} style={iconBtn} title="기본값으로">
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
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

const overriddenBadge = {
  display: 'inline-block',
  padding: '1px 7px',
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 999,
  background: '#DBEAFE',
  color: '#1D4ED8',
  flexShrink: 0,
}

const iconBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  marginLeft: 4,
  background: 'transparent',
  border: '1px solid var(--border, #E5E7EB)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text-secondary, #374151)',
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
