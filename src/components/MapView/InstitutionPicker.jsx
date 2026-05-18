import { Building2, ChevronRight } from 'lucide-react'

export default function InstitutionPicker({ subEntities, selectedName, onSelect }) {
  if (!subEntities?.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        등록된 기관이 없습니다
      </div>
    )
  }

  return (
    <ul
      role="list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        listStyle: 'none',
      }}
    >
      {subEntities.map(sub => {
        const active = sub.name === selectedName
        const sourceCount = sub.sources?.length ?? 0
        return (
          <li key={sub.name}>
            <button
              onClick={() => onSelect(sub.name)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: active ? 'var(--accent-light)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--accent)' : 'var(--text-primary)',
                textAlign: 'left',
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={e => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              <Building2 size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sub.name}
              </span>
              {sourceCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  {sourceCount}
                </span>
              )}
              <ChevronRight
                size={14}
                style={{
                  flexShrink: 0,
                  opacity: active ? 1 : 0.3,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                }}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
