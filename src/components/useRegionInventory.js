import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Inventory roll-up.
 *
 * Returns { status, totalNotices, latestAt,
 *           byRegion: [{ region, total, byEntity: [{name, count}], latestAt }] }
 *
 * Fetches every notice in notices_v2 (no time filter) so per-org counts
 * match what NoticeList renders below — clicking an "X건" chip and
 * seeing X notices in the list right under it. With ~2k rows in the
 * table this is a single small query; the cap is 10000.
 */
export default function useRegionInventory() {
  const [state, setState] = useState({
    status: 'loading',
    totalNotices: 0,
    latestAt: null,
    byRegion: [],
  })

  useEffect(() => {
    let cancelled = false
    supabase
      .from('notices_v2')
      .select('region,sub_entity,posted_at,scraped_at')
      .limit(10000)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ status: 'error', totalNotices: 0, latestAt: null, byRegion: [], error: error.message })
          return
        }
        const rows = data || []
        // group by region
        const grouped = new Map()
        let latestAt = null
        for (const row of rows) {
          const region = row.region || '-'
          const sub = row.sub_entity || '-'
          const t = row.scraped_at ? Date.parse(row.scraped_at) : null
          if (t && (!latestAt || t > latestAt)) latestAt = t

          let g = grouped.get(region)
          if (!g) {
            g = { region, total: 0, byEntity: new Map(), latestAt: null }
            grouped.set(region, g)
          }
          g.total += 1
          g.byEntity.set(sub, (g.byEntity.get(sub) || 0) + 1)
          if (t && (!g.latestAt || t > g.latestAt)) g.latestAt = t
        }

        // shape + sort
        const byRegion = Array.from(grouped.values())
          .map(g => ({
            region: g.region,
            total: g.total,
            latestAt: g.latestAt,
            byEntity: Array.from(g.byEntity.entries())
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count),
          }))
          .sort((a, b) => b.total - a.total)

        setState({
          status: 'ready',
          totalNotices: rows.length,
          latestAt,
          byRegion,
        })
      })
    return () => { cancelled = true }
  }, [])

  return state
}
