import { useCallback, useState } from 'react'
import Header from './components/Header.jsx'
import MapView from './components/MapView/MapView.jsx'
import InventoryView from './components/InventoryView.jsx'
import RegionDetailPanel from './components/RegionDetailPanel.jsx'
import useViewMode from './hooks/useViewMode.js'

export default function App() {
  const [viewMode, setViewMode] = useViewMode()
  // Shared selection that drives the side-by-side detail panel.
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
  const updateSub = useCallback(
    sub => setSelected(prev => prev ? { ...prev, sub } : prev),
    [],
  )

  const panelOpen = !!selected

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header viewMode={viewMode} setViewMode={setViewMode} />
      {/* Main area: view on the left + (optional) detail panel on the right */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {viewMode === 'map' ? (
            <MapView
              selected={selected}
              onPickRegion={pickRegion}
              onPickSub={pickSub}
            />
          ) : (
            <InventoryView onPick={pickRegion} />
          )}
        </div>
        {panelOpen && (
          <RegionDetailPanel
            region={selected.region}
            initialSub={selected.sub}
            onSelectSub={updateSub}
            onClose={closePanel}
          />
        )}
      </div>
    </div>
  )
}
