import { useMemo, useState } from 'react'
import regionsData from '../../data/regions.json'
import useNoticeCounts from './useNoticeCounts.js'
import { NON_GEOGRAPHIC_REGIONS } from './regionNameMap.js'
import KoreaMap from './KoreaMap.jsx'
import RegionPanel from './RegionPanel.jsx'

export default function MapView() {
  const { counts: countsByRegion, status: countsStatus, max } = useNoticeCounts(30)

  const [selectedRegion, setSelectedRegion] = useState(null)
  const [selectedMunicipality, setSelectedMunicipality] = useState(null)
  const [unzonedRegion, setUnzonedRegion] = useState(null) // for "지역 미지정" chips

  const activeRegionName = unzonedRegion ?? selectedRegion?.region ?? null

  const subEntities = useMemo(() => {
    if (!activeRegionName) return null
    const r = regionsData.find(x => x.region === activeRegionName)
    return r?.subEntities ?? null
  }, [activeRegionName])

  const unzonedRegions = useMemo(
    () => regionsData
      .filter(r => NON_GEOGRAPHIC_REGIONS.has(r.region))
      .map(r => ({ region: r.region, count: r.subEntities.length })),
    []
  )

  const handleSelectRegion = (sel) => {
    setSelectedMunicipality(null)
    setUnzonedRegion(null)
    setSelectedRegion(sel)
  }

  const handleSelectMunicipality = (m) => {
    setSelectedMunicipality(m)
  }

  const handleClosePanel = () => {
    setSelectedMunicipality(null)
    setUnzonedRegion(null)
    setSelectedRegion(null)
  }

  const handlePickUnzoned = (regionName) => {
    setSelectedRegion(null)
    setSelectedMunicipality(null)
    setUnzonedRegion(regionName)
  }

  const panelOpen = !!activeRegionName

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        margin: '20px auto',
        padding: '0 20px',
        width: '100%',
        maxWidth: 1440,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            대한민국 공공기관 지도
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            최근 30일 공지 수 기준 히트맵 ·
            {countsStatus === 'loading' && ' 데이터 불러오는 중…'}
            {countsStatus === 'ok' && ` 최다 ${max}건`}
            {countsStatus === 'error' && ' 데이터 연결 오류'}
          </div>
        </div>

        {/* Non-geographic regions surfaced as chips */}
        {unzonedRegions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              지역 미지정
            </span>
            {unzonedRegions.map(({ region, count }) => (
              <button
                key={region}
                onClick={() => handlePickUnzoned(region)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: unzonedRegion === region ? 'var(--accent)' : 'var(--bg-card)',
                  color: unzonedRegion === region ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                }}
              >
                {region} <span style={{ opacity: 0.65 }}>· {count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 480,
        }}
      >
        <KoreaMap
          countsByRegion={countsByRegion}
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
          onSelectMunicipality={handleSelectMunicipality}
        />

        <RegionPanel
          open={panelOpen}
          region={activeRegionName}
          subEntities={subEntities}
          municipalityHint={selectedMunicipality?.name ?? null}
          onClose={handleClosePanel}
        />
      </div>
    </div>
  )
}
