import { useEffect, useState } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { X, MapPin } from 'lucide-react'
import NoticeList from '../NoticeList.jsx'
import InstitutionPicker from './InstitutionPicker.jsx'

export default function RegionPanel({
  open,
  region,
  subEntities,
  municipalityHint,
  onClose,
}) {
  const [selectedSub, setSelectedSub] = useState(null)

  // Reset institution selection whenever the region changes.
  useEffect(() => {
    setSelectedSub(subEntities?.[0]?.name ?? null)
  }, [region, subEntities])

  const spring = useSpring({
    transform: open ? 'translateX(0%)' : 'translateX(105%)',
    opacity: open ? 1 : 0,
    config: { tension: 280, friction: 30 },
  })

  return (
    <animated.aside
      aria-hidden={!open}
      style={{
        ...spring,
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(420px, 92%)',
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        borderTopLeftRadius: 'var(--radius)',
        borderBottomLeftRadius: 'var(--radius)',
        boxShadow: '-12px 0 32px rgba(13,27,110,0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            <MapPin size={12} />
            선택된 지역
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginTop: 4,
              lineHeight: 1.2,
              wordBreak: 'keep-all',
            }}
          >
            {region ?? '—'}
          </h2>
          {municipalityHint && (
            <div
              style={{
                marginTop: 8,
                display: 'inline-block',
                fontSize: 11,
                color: 'var(--accent)',
                background: 'var(--accent-light)',
                padding: '3px 10px',
                borderRadius: 999,
                fontWeight: 500,
              }}
            >
              {municipalityHint} · 행정구별 분류는 곧 지원 예정
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </header>

      {/* Institutions list */}
      <section
        style={{
          padding: '14px 20px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <SectionLabel title="기관" count={subEntities?.length ?? 0} />
        <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto' }}>
          <InstitutionPicker
            subEntities={subEntities}
            selectedName={selectedSub}
            onSelect={setSelectedSub}
          />
        </div>
      </section>

      {/* Notices for selected institution */}
      <section
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '14px 20px 20px',
        }}
      >
        <SectionLabel title="최근 공지사항" subtitle={selectedSub ?? undefined} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 10 }}>
          {region && selectedSub ? (
            <NoticeList region={region} subEntity={selectedSub} />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              기관을 선택하세요
            </div>
          )}
        </div>
      </section>
    </animated.aside>
  )
}

function SectionLabel({ title, count, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {title}
      </span>
      {count != null && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--accent)',
            background: 'var(--accent-light)',
            padding: '2px 7px',
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
      {subtitle && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          · {subtitle}
        </span>
      )}
    </div>
  )
}
