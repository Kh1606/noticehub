import { List, Map as MapIcon } from 'lucide-react'

const OPTIONS = [
  { value: 'list', label: '목록', Icon: List },
  { value: 'map', label: '지도', Icon: MapIcon },
]

export default function ModeToggle({ viewMode, setViewMode }) {
  return (
    <div
      role="tablist"
      aria-label="보기 모드"
      style={{
        display: 'inline-flex',
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 999,
        padding: 3,
        gap: 2,
      }}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = viewMode === value
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => setViewMode(value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: active ? 'var(--sidebar-bg)' : '#fff',
              background: active ? 'var(--accent-cyan)' : 'transparent',
              transition: 'background 0.18s ease, color 0.18s ease',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
