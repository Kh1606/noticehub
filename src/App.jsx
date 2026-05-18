import { useMemo, useState } from 'react'
import regionsData from './data/regions.json'
import Header from './components/Header.jsx'
import RegionSidebar from './components/RegionSidebar.jsx'
import SourceCard from './components/SourceCard.jsx'
import NoticeList from './components/NoticeList.jsx'
import RecentFeed from './components/RecentFeed.jsx'
import MapView from './components/MapView/MapView.jsx'
import useViewMode from './hooks/useViewMode.js'

export default function App() {
  const [viewMode, setViewMode] = useViewMode()
  const [selected, setSelected] = useState(null)

  const selectedSub = useMemo(() => {
    if (!selected) return null
    const r = regionsData.find(r => r.region === selected.region)
    return r?.subEntities.find(s => s.name === selected.sub) ?? null
  }, [selected])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header viewMode={viewMode} setViewMode={setViewMode} />
      {viewMode === 'map' ? (
        <MapView />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '260px 1fr',
            gap: 20,
            padding: 20,
            flex: 1,
            minHeight: 0,
            maxWidth: 1440,
            width: '100%',
            margin: '0 auto',
          }}
          className="clt-shell"
        >
          <RegionSidebar
            regions={regionsData}
            selected={selected}
            onSelect={setSelected}
          />
          <main style={{ minWidth: 0, overflow: 'auto' }}>
            {!selected && <RecentFeed onSelect={setSelected} />}
            {selected && selectedSub && (
              <SubEntityView region={selected.region} sub={selectedSub} />
            )}
          </main>
        </div>
      )}
      <ResponsiveStyles />
    </div>
  )
}

function SubEntityView({ region, sub }) {
  const [noticeCount, setNoticeCount] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{region}</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
          {sub.name}
        </h1>
      </div>

      <section>
        <SectionHeader
          title="출처 페이지"
          count={sub.sources.length}
          subtitle="원문 사이트로 이동합니다"
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            marginTop: 12,
          }}
        >
          {sub.sources.map((src, i) => (
            <SourceCard key={`${src.url}-${i}`} source={src} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="최근 공지사항"
          count={noticeCount ?? undefined}
          subtitle="Supabase 실시간 조회"
        />
        <NoticeList region={region} subEntity={sub.name} onCount={setNoticeCount} />
      </section>
    </div>
  )
}

function SectionHeader({ title, count, subtitle }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 8,
      }}
    >
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {count != null && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--accent)',
            background: 'var(--accent-light)',
            padding: '2px 8px',
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
      {subtitle && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</span>
      )}
    </div>
  )
}

function ResponsiveStyles() {
  return (
    <style>{`
      @media (max-width: 1023px) {
        .clt-shell {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  )
}
