import { useEffect, useMemo, useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { geoCentroid } from 'd3-geo'
import { useSpring } from '@react-spring/web'
import { ArrowLeft } from 'lucide-react'
import { geoNameToRegion } from './regionNameMap.js'

const PROVINCES_URL = `${import.meta.env.BASE_URL}data/skorea-provinces-topo.json`
const MUNICIPALITIES_URL = `${import.meta.env.BASE_URL}data/skorea-municipalities-topo.json`

// Projection tuned for South Korea — keeps the peninsula well-centered.
const PROJECTION_CONFIG = {
  scale: 5500,
  center: [127.8, 36.0],
}

const DEFAULT_CENTER = PROJECTION_CONFIG.center
const ZOOM_IN = 3.5

export default function KoreaMap({
  countsByRegion,
  selectedRegion,
  onSelectRegion,
  onSelectMunicipality,
}) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hover, setHover] = useState(null) // { x, y, label, count }
  const [muniData, setMuniData] = useState(null)
  const [muniLoading, setMuniLoading] = useState(false)

  // Animated camera state (driven by react-spring → React state, per-frame).
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState(DEFAULT_CENTER)

  // Track container size for a responsive SVG viewport.
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Lazy-load municipalities on first drill-in.
  useEffect(() => {
    if (!selectedRegion || muniData || muniLoading) return
    setMuniLoading(true)
    fetch(MUNICIPALITIES_URL)
      .then(r => r.json())
      .then(json => setMuniData(json))
      .catch(err => console.error('Failed to load municipalities:', err))
      .finally(() => setMuniLoading(false))
  }, [selectedRegion, muniData, muniLoading])

  // Compute target zoom/center from selection.
  const target = useMemo(() => {
    if (selectedRegion?.centroid) {
      return { zoom: ZOOM_IN, cx: selectedRegion.centroid[0], cy: selectedRegion.centroid[1] }
    }
    return { zoom: 1, cx: DEFAULT_CENTER[0], cy: DEFAULT_CENTER[1] }
  }, [selectedRegion])

  // Spring drives zoom + center via per-frame state updates.
  useSpring({
    zoom: target.zoom,
    cx: target.cx,
    cy: target.cy,
    config: { tension: 180, friction: 28 },
    onChange: ({ value }) => {
      setZoom(value.zoom)
      setCenter([value.cx, value.cy])
    },
  })

  const selectedProvinceCode = selectedRegion?.code ?? null
  const showMunicipalities = !!selectedProvinceCode && !!muniData

  const handleProvinceClick = (geo) => {
    const regionName = geoNameToRegion(geo.properties.name)
    const centroid = geoCentroid(geo)
    onSelectRegion({
      region: regionName,
      code: geo.properties.code,
      geoName: geo.properties.name,
      centroid,
    })
  }

  const handleBack = () => onSelectRegion(null)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #F5F9FF 0%, #E1EEFB 100%)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={PROJECTION_CONFIG}
        width={size.w}
        height={size.h}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={1}
          maxZoom={6}
          filterZoomEvent={evt => evt.type === 'click'}
        >
          <Geographies geography={PROVINCES_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const regionName = geoNameToRegion(geo.properties.name)
                const count = countsByRegion[regionName] ?? 0
                const isSelected = selectedProvinceCode === geo.properties.code
                const isOther = selectedProvinceCode && !isSelected
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleProvinceClick(geo)}
                    onMouseEnter={e =>
                      setHover({
                        x: e.clientX,
                        y: e.clientY,
                        label: geo.properties.name,
                        count,
                      })
                    }
                    onMouseMove={e =>
                      setHover(h => h ? { ...h, x: e.clientX, y: e.clientY } : null)
                    }
                    onMouseLeave={() => setHover(null)}
                    style={{
                      default: {
                        fill: count > 0 ? 'var(--accent)' : '#CFE0F4',
                        fillOpacity: isOther ? 0.18 : countOpacity(count, countsByRegion),
                        stroke: '#FFFFFF',
                        strokeWidth: 0.8,
                        outline: 'none',
                        transition: 'fill-opacity 0.25s ease, fill 0.25s ease',
                        cursor: 'pointer',
                      },
                      hover: {
                        fill: 'var(--primary-mid)',
                        fillOpacity: isOther ? 0.35 : 0.95,
                        stroke: '#FFFFFF',
                        strokeWidth: 1,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: 'var(--accent-hover)',
                        outline: 'none',
                      },
                    }}
                  />
                )
              })
            }
          </Geographies>

          {showMunicipalities && (
            <MunicipalityLayer
              topo={muniData}
              parentCode={selectedProvinceCode}
              onSelect={onSelectMunicipality}
              setHover={setHover}
            />
          )}
        </ZoomableGroup>
      </ComposableMap>

      {hover && (
        <div
          style={{
            position: 'fixed',
            left: hover.x + 14,
            top: hover.y + 14,
            pointerEvents: 'none',
            background: 'var(--sidebar-bg)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          {hover.label}
          {hover.count != null && (
            <span style={{ opacity: 0.75, marginLeft: 6 }}>
              · {hover.count}건
            </span>
          )}
        </div>
      )}

      {selectedRegion && (
        <button
          onClick={handleBack}
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--accent)',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 20,
          }}
        >
          <ArrowLeft size={14} />
          전국 보기
        </button>
      )}

      {muniLoading && selectedRegion && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            padding: '6px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            fontSize: 12,
            color: 'var(--text-muted)',
            zIndex: 20,
          }}
        >
          행정구역 불러오는 중…
        </div>
      )}
    </div>
  )
}

function countOpacity(count, countsByRegion) {
  const max = Object.values(countsByRegion).reduce((a, b) => Math.max(a, b), 0)
  if (max === 0) return 0.35
  const t = count / max
  return 0.35 + t * 0.55
}

function MunicipalityLayer({ topo, parentCode, onSelect, setHover }) {
  const filtered = useMemo(() => {
    const key = Object.keys(topo.objects)[0]
    const obj = topo.objects[key]
    return {
      ...topo,
      objects: {
        [key]: {
          ...obj,
          geometries: obj.geometries.filter(g =>
            String(g.properties.code).startsWith(parentCode)
          ),
        },
      },
    }
  }, [topo, parentCode])

  const [shown, setShown] = useState(false)
  useEffect(() => {
    setShown(false)
    const t = setTimeout(() => setShown(true), 120)
    return () => clearTimeout(t)
  }, [parentCode])

  return (
    <Geographies geography={filtered}>
      {({ geographies }) =>
        geographies.map((geo, i) => (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            onClick={() => onSelect({
              name: geo.properties.name,
              code: geo.properties.code,
            })}
            onMouseEnter={e => setHover({
              x: e.clientX,
              y: e.clientY,
              label: geo.properties.name,
              count: null,
            })}
            onMouseMove={e => setHover(h => h ? { ...h, x: e.clientX, y: e.clientY } : null)}
            onMouseLeave={() => setHover(null)}
            style={{
              default: {
                fill: 'var(--accent)',
                fillOpacity: shown ? 0.45 : 0,
                stroke: '#FFFFFF',
                strokeWidth: 0.4,
                outline: 'none',
                transition: `fill-opacity 0.4s ease ${i * 8}ms`,
                cursor: 'pointer',
              },
              hover: {
                fill: 'var(--primary-mid)',
                fillOpacity: 0.85,
                stroke: '#FFFFFF',
                strokeWidth: 0.6,
                outline: 'none',
                cursor: 'pointer',
              },
              pressed: { fill: 'var(--accent-hover)', outline: 'none' },
            }}
          />
        ))
      }
    </Geographies>
  )
}
