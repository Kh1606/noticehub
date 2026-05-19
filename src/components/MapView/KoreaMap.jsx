import { useEffect, useMemo, useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { geoCentroid } from 'd3-geo'
import { useSpring } from '@react-spring/web'
import { ArrowLeft } from 'lucide-react'
import { geoNameToRegion } from './regionNameMap.js'
import { makeColorScale } from './colorScale.js'

const PROVINCES_URL = `${import.meta.env.BASE_URL}data/skorea-provinces-topo.json`
const MUNICIPALITIES_URL = `${import.meta.env.BASE_URL}data/skorea-municipalities-topo.json`

// Projection tuned for South Korea — keeps the peninsula well-centered.
const PROJECTION_CONFIG = { scale: 5500, center: [127.8, 36.0] }
const DEFAULT_CENTER = PROJECTION_CONFIG.center
const ZOOM_IN = 3.5

// Color used for provinces / sub-regions with zero notices.
// Warmer/darker gray than #E5E7EB so it doesn't blend into the
// light-blue map background gradient.
const INACTIVE_FILL = '#C8CDD5'

// Color used for the sub-region the user has currently picked (synced
// with the right-panel selection). Distinct from both blue + gray.
const SELECTED_FILL = '#F97316'      // orange-500
const SELECTED_STROKE = '#C2410C'    // orange-700

/**
 * @param countsByRegion     { [regionName]: total }
 * @param countsBySub        { [regionName]: { [subName]: count } }
 * @param selectedRegionName string | null (from App.selected.region)
 * @param selectedSubName    string | null (from App.selected.sub) — drives
 *                           orange highlight on the picked sub-region
 * @param onPickRegion(regionName)
 * @param onPickSub(regionName, subName)
 */
export default function KoreaMap({
  countsByRegion,
  countsBySub,
  selectedRegionName,
  selectedSubName,
  onPickRegion,
  onPickSub,
}) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hover, setHover] = useState(null) // { x, y, label, count }
  const [muniData, setMuniData] = useState(null)
  const [muniLoading, setMuniLoading] = useState(false)

  // Animated camera state (driven by react-spring → React state, per-frame).
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState(DEFAULT_CENTER)

  // Selected province's TopoJSON code + centroid (looked up from geographies).
  const [selectedProvince, setSelectedProvince] = useState(null) // { code, centroid }

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
    if (!selectedRegionName || muniData || muniLoading) return
    setMuniLoading(true)
    fetch(MUNICIPALITIES_URL)
      .then(r => r.json())
      .then(json => setMuniData(json))
      .catch(err => console.error('Failed to load municipalities:', err))
      .finally(() => setMuniLoading(false))
  }, [selectedRegionName, muniData, muniLoading])

  // When App's selected.region changes, clear the local province cache so
  // the next "found" lookup runs against the new region.
  useEffect(() => {
    if (!selectedRegionName) {
      setSelectedProvince(null)
    }
  }, [selectedRegionName])

  // Spring drives zoom + center via per-frame state updates.
  const target = useMemo(() => {
    if (selectedProvince?.centroid) {
      return {
        zoom: ZOOM_IN,
        cx: selectedProvince.centroid[0],
        cy: selectedProvince.centroid[1],
      }
    }
    return { zoom: 1, cx: DEFAULT_CENTER[0], cy: DEFAULT_CENTER[1] }
  }, [selectedProvince])

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

  const showMunicipalities = !!selectedProvince && !!muniData

  // Color scale for province coloring.
  const maxCount = useMemo(
    () => Object.values(countsByRegion).reduce((a, b) => Math.max(a, b), 0),
    [countsByRegion],
  )
  const colorScale = useMemo(() => makeColorScale(maxCount), [maxCount])

  // Pre-compute the sub-name → count map for the currently-selected region,
  // with name normalization so TopoJSON municipality names (e.g. `청주시상당구`,
  // `중구`) resolve to v2 sub_entity names (e.g. `청주시-상당구`, `대구시청`).
  const subLookup = useMemo(() => {
    if (!selectedRegionName) return null
    const subs = countsBySub[selectedRegionName] || {}
    return buildSubMatcher(subs)
  }, [countsBySub, selectedRegionName])

  // Pre-compute max sub-count for the selected region (drives sub color scale).
  const maxSubCount = useMemo(() => {
    if (!selectedRegionName) return 0
    const m = countsBySub[selectedRegionName] || {}
    return Object.values(m).reduce((a, b) => Math.max(a, b, 0), 0)
  }, [countsBySub, selectedRegionName])
  const subColorScale = useMemo(() => makeColorScale(maxSubCount), [maxSubCount])

  const handleProvinceClick = (geo) => {
    const regionName = geoNameToRegion(geo.properties.name)
    const centroid = geoCentroid(geo)
    setSelectedProvince({ code: geo.properties.code, centroid })
    onPickRegion?.(regionName)
  }

  const handleMunicipalityClick = (geo) => {
    if (!selectedRegionName || !subLookup) return
    const subName = subLookup.match(geo.properties.name)
    // Only react when the click maps to an actual v2 sub-entity. Clicks on
    // inactive (gray) sub-regions do nothing — the user can still click
    // back to province level via "전국 보기".
    if (subName) onPickSub?.(selectedRegionName, subName)
  }

  const handleBack = () => {
    setSelectedProvince(null)
    // Don't auto-close the side panel — user may want to keep browsing.
  }

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
                const isSelected = selectedProvince?.code === geo.properties.code
                const isOther = !!selectedProvince && !isSelected
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
                        fill: count > 0 ? colorScale(count) : INACTIVE_FILL,
                        fillOpacity: isOther ? 0.35 : 1,
                        stroke: '#FFFFFF',
                        strokeWidth: 0.8,
                        outline: 'none',
                        transition: 'fill-opacity 0.25s ease, fill 0.25s ease',
                        cursor: 'pointer',
                      },
                      hover: {
                        fill: count > 0 ? 'var(--primary-mid)' : '#CFD3DA',
                        fillOpacity: isOther ? 0.5 : 1,
                        stroke: '#FFFFFF',
                        strokeWidth: 1,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: { fill: 'var(--accent-hover)', outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>

          {showMunicipalities && (
            <MunicipalityLayer
              topo={muniData}
              parentCode={selectedProvince.code}
              subLookup={subLookup}
              subColorScale={subColorScale}
              selectedSubName={selectedSubName}
              onClick={handleMunicipalityClick}
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

      {selectedProvince && (
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
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          전국 보기
        </button>
      )}

      {muniLoading && selectedRegionName && (
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

function MunicipalityLayer({ topo, parentCode, subLookup, subColorScale, selectedSubName, onClick, setHover }) {
  const filtered = useMemo(() => {
    const key = Object.keys(topo.objects)[0]
    const obj = topo.objects[key]
    return {
      ...topo,
      objects: {
        [key]: {
          ...obj,
          geometries: obj.geometries.filter(g =>
            String(g.properties.code).startsWith(parentCode),
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
        geographies.map((geo, i) => {
          const muniName = geo.properties.name
          const matchedSub = subLookup?.match(muniName) ?? null
          const count = matchedSub ? (subLookup.counts[matchedSub] ?? 0) : 0
          const isSelected = matchedSub && matchedSub === selectedSubName
          const baseFill = isSelected
            ? SELECTED_FILL
            : count > 0 ? subColorScale(count) : INACTIVE_FILL
          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              onClick={() => onClick(geo)}
              onMouseEnter={e => setHover({
                x: e.clientX,
                y: e.clientY,
                label: muniName,
                count: count > 0 ? count : null,
              })}
              onMouseMove={e => setHover(h => h ? { ...h, x: e.clientX, y: e.clientY } : null)}
              onMouseLeave={() => setHover(null)}
              style={{
                default: {
                  fill: baseFill,
                  fillOpacity: shown ? 1 : 0,
                  stroke: isSelected ? SELECTED_STROKE : '#FFFFFF',
                  strokeWidth: isSelected ? 1.4 : 0.4,
                  outline: 'none',
                  transition: `fill-opacity 0.4s ease ${i * 8}ms, fill 0.25s ease, stroke 0.15s`,
                  cursor: count > 0 ? 'pointer' : 'default',
                },
                hover: {
                  fill: isSelected ? SELECTED_FILL : (count > 0 ? 'var(--primary-mid)' : '#9CA3AF'),
                  fillOpacity: 1,
                  stroke: isSelected ? SELECTED_STROKE : '#FFFFFF',
                  strokeWidth: isSelected ? 1.4 : 0.7,
                  outline: 'none',
                  cursor: count > 0 ? 'pointer' : 'default',
                },
                pressed: { fill: 'var(--accent-hover)', outline: 'none' },
              }}
            />
          )
        })
      }
    </Geographies>
  )
}

/**
 * Build a matcher from TopoJSON municipality names to v2 sub_entity names.
 * The two name spaces use different conventions:
 *   topo: `청주시상당구`, `중구`, `김해시`
 *   v2:   `청주시-상당구`, `대구시청`, `김해시`
 *
 * We index every v2 sub name with a handful of normalized variants
 * (lowercase, hyphen-stripped, suffix-stripped) so direct lookup is O(1).
 * Returns { counts, match(muniName) -> v2SubName | null }.
 */
function buildSubMatcher(countsForRegion) {
  const counts = countsForRegion || {}
  const index = new Map() // normalizedKey -> v2SubName

  for (const subName of Object.keys(counts)) {
    for (const key of subVariants(subName)) {
      if (!index.has(key)) index.set(key, subName)
    }
  }

  return {
    counts,
    match(muniName) {
      if (!muniName) return null
      for (const key of muniVariants(muniName)) {
        if (index.has(key)) return index.get(key)
      }
      return null
    },
  }
}

function subVariants(name) {
  const v = new Set()
  const norm = name.trim()
  v.add(norm)
  // Hyphen-stripped: 청주시-상당구 -> 청주시상당구
  v.add(norm.replace(/-/g, ''))
  // Strip city prefix: 청주시-상당구 -> 상당구
  const m = norm.match(/^([가-힣]+시)-?([가-힣]+(?:구|군))$/)
  if (m) v.add(m[2])
  // Strip 시청/도청 suffix only.
  // (Older code also tried `(시청|도청|구청|군청)$ -> 시` which
  // incorrectly produced 경기시 from 경기도청 — removed.)
  v.add(norm.replace(/시청$/u, '시'))
  v.add(norm.replace(/도청$/u, '도'))
  return Array.from(v).filter(Boolean)
}

function muniVariants(name) {
  const v = new Set()
  const norm = name.trim()
  v.add(norm)
  // For TopoJSON city-district names like 청주시상당구 / 용인시수지구 /
  // 수원시영통구 (no separator between city and district):
  const m = norm.match(/^([가-힣]+시)([가-힣]+(?:구|군))$/)
  if (m) {
    v.add(`${m[1]}-${m[2]}`) // hyphenated form for v2 match
    v.add(m[2])              // bare district name
    v.add(m[1])              // PARENT CITY — so 용인시수지구 also matches 용인시청 (v2)
  }
  return Array.from(v).filter(Boolean)
}
