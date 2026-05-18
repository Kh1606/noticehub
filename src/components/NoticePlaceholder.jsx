export default function NoticePlaceholder() {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '32px 24px',
        background: 'var(--bg-card)',
        border: '1px dashed var(--border-light)',
        borderRadius: 'var(--radius)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
        수집된 공지사항이 없습니다
      </div>
      <div style={{ fontSize: 12 }}>이 기관은 아직 크롤러 대상에 포함되지 않았거나 공지가 없습니다.</div>
    </div>
  )
}
