import { useEffect, useSyncExternalStore } from 'react'
import {
  subscribeInventory,
  getInventory,
  loadInventory,
  refreshInventory,
} from '../lib/inventoryStore.js'

/**
 * Inventory roll-up.
 *
 * Same return shape as before — `{ status, totalNotices, latestAt, byRegion }` —
 * plus extras every consumer can ignore (`refreshing, fetchedAt, error, rows,
 * todayTotal`; each byRegion item now also carries `todayCount, weekCount`).
 *
 * What changed: the actual fetch + aggregation now live in lib/inventoryStore.js.
 * All consumers (InventoryView, RegionDetailPanel, MapView) read the SAME
 * cached snapshot, so we no longer hit Supabase three times when the user
 * switches view mode or opens the panel.
 *
 * Note on `status:'idle'`: that's the very first observable value before
 * the loader fires. Existing consumers only branch on `'loading' | 'error' |
 * 'ready'`; `idle` falls through to the same render path as `loading`
 * (`byRegion: []`, `totalNotices: 0`), which is what every consumer already
 * shows during the first paint.
 */
export default function useRegionInventory() {
  const s = useSyncExternalStore(subscribeInventory, getInventory, getInventory)
  useEffect(() => { loadInventory() }, [])
  return { ...s, refresh: refreshInventory }
}
