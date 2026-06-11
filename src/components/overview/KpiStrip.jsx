// Top-of-overview KPI strip — 5 cards, auto-fit so it wraps gracefully on
// narrow viewports. Values are passed in pre-formatted; the strip itself
// only handles layout, skeleton state, and the accent treatment for the
// "오늘 신규" card when today's count is non-zero.

export default function KpiStrip({ loading, items }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginTop: 14,
      }}
    >
      {items.map(it => (
        <div
          key={it.key}
          style={{
            padding: '14px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            {it.label}
          </div>
          {loading ? (
            <div
              className="skeleton"
              style={{ height: 24, width: 72, marginTop: 6 }}
            />
          ) : (
            <div
              title={it.title}
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: it.accent ? 'var(--accent)' : 'var(--text-primary)',
                marginTop: 4,
                fontFamily: 'var(--font-num)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}
            >
              {it.value}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
