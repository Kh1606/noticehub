import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'

export default function RegionSidebar({ regions, selected, onSelect }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set([selected?.region]))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return regions
    return regions
      .map(r => ({
        ...r,
        subEntities: r.subEntities.filter(s => s.name.toLowerCase().includes(q)),
      }))
      .filter(r => r.subEntities.length > 0 || r.region.toLowerCase().includes(q))
  }, [regions, query])

  const toggle = region => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(region) ? next.delete(region) : next.add(region)
      return next
    })
  }

  // Auto-expand when searching
  const visibleExpanded = query.trim()
    ? new Set(filtered.map(r => r.region))
    : expanded

  return (
    <aside
      style={{
        background: 'var(--sidebar-bg)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-md)',
        padding: 12,
        height: 'fit-content',
        maxHeight: 'calc(100vh - 140px)',
        overflowY: 'auto',
        position: 'sticky',
        top: 24,
      }}
    >
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search
          size={13}
          style={{
            position: 'absolute',
            left: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.35)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="기관 검색…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px 7px 28px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          padding: '0 8px 8px',
        }}
      >
        지역 · 기관
      </div>

      <ul style={{ listStyle: 'none' }}>
        {filtered.map(r => {
          const isOpen = visibleExpanded.has(r.region)
          return (
            <li key={r.region}>
              <button
                onClick={() => toggle(r.region)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.85)',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {isOpen ? (
                  <ChevronDown size={14} style={{ marginRight: 6, flexShrink: 0, opacity: 0.6 }} />
                ) : (
                  <ChevronRight size={14} style={{ marginRight: 6, flexShrink: 0, opacity: 0.6 }} />
                )}
                <span style={{ flex: 1 }}>{r.region}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                  {r.subEntities.length}
                </span>
              </button>

              {isOpen && (
                <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2, marginBottom: 4 }}>
                  {r.subEntities.map(s => {
                    const isActive =
                      selected?.region === r.region && selected?.sub === s.name
                    return (
                      <li key={s.name}>
                        <button
                          onClick={() => {
                            onSelect({ region: r.region, sub: s.name })
                            if (!expanded.has(r.region)) {
                              setExpanded(prev => new Set([...prev, r.region]))
                            }
                          }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 12,
                            color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                            background: isActive
                              ? 'rgba(0,174,239,0.3)'
                              : 'transparent',
                            borderLeft: isActive
                              ? '2px solid var(--accent-cyan)'
                              : '2px solid transparent',
                            fontWeight: isActive ? 600 : 400,
                            textAlign: 'left',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => {
                            if (!isActive)
                              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                          }}
                          onMouseLeave={e => {
                            if (!isActive) e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <span>{s.name}</span>
                          <span style={{ fontSize: 10, opacity: 0.4, fontWeight: 500 }}>
                            {s.sources.length}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {filtered.length === 0 && (
        <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          검색 결과 없음
        </div>
      )}
    </aside>
  )
}
