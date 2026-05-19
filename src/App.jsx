import { useCallback, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import MapView from './components/MapView/MapView.jsx'
import InventoryView from './components/InventoryView.jsx'
import RegionDetailPanel from './components/RegionDetailPanel.jsx'
import useViewMode from './hooks/useViewMode.js'
import LoginPage from './components/admin/LoginPage.jsx'
import RequireAdmin from './components/admin/RequireAdmin.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import AdminHome from './components/admin/AdminHome.jsx'
import SourcesPage from './components/admin/SourcesPage.jsx'
import HistoryPage from './components/admin/HistoryPage.jsx'
import ErrorsPage from './components/admin/ErrorsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicApp />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="errors" element={<ErrorsPage />} />
      </Route>
    </Routes>
  )
}

function PublicApp() {
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
