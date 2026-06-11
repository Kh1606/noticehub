// Segmented sort control for the 개요 region grid.
//
// Visual language clones the panel's PeriodChip (active = --accent
// background, white text) so the two segmented patterns read as one
// family. The default ('count') re-renders the exact same order the v1
// 개요 had — total desc — so the regression check on initial load is byte-
// identical.

const OPTIONS = [
  { key: 'count',  label: '공지순' },
  { key: 'recent', label: '수집순' },
  { key: 'name',   label: '가나다순' },
]

export default function SortControl({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="지역 정렬"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      {OPTIONS.map(o => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange?.(o.key)}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 999,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: active ? 'var(--accent)' : 'var(--bg-card)',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = 'var(--bg-card)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
