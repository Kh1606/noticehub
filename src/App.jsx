import { useCallback, useState } from 'react'
import Header from './components/Header.jsx'
import MapView from './components/MapView/MapView.jsx'
import InventoryView from './components/InventoryView.jsx'
import RegionDetailPanel from './components/RegionDetailPanel.jsx'
import useViewMode from './hooks/useViewMode.js'

export default function App() {
  const [viewMode, setViewMode] = useViewMode()
  // App-level shared selection: triggered by InventoryView card click OR
  // KoreaMap province/sub click. Drives the right-side RegionDetailPanel.
  //   { region: string, sub: string | null } | null
  const [selected, setSelected] = useState(null)

  const closePanel = useCallback(() => setSelected(null), [])
  const pickRegion = useCallback(
    region => setSelected({ region, sub: null }),
    [],
  )
  const pickSub = useCallback(
    (region, sub) => setSelected({ region, sub }),
    [],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header viewMode={viewMode} setViewMode={setViewMode} />
      {viewMode === 'map' ? (
        <MapView
          selected={selected}
          onPickRegion={pickRegion}
          onPickSub={pickSub}
        />
      ) : (
        <InventoryView onPick={pickRegion} />
      )}
      <RegionDetailPanel
        open={!!selected}
        region={selected?.region}
        initialSub={selected?.sub}
        onClose={closePanel}
      />
    </div>
  )
}
