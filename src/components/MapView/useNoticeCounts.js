import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

function isoNDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// One-shot Supabase query at mount: pulls `region` for every notice in the
// lookback window, groups client-side. ~thousands of rows is trivial in JS.
export default function useNoticeCounts(lookbackDays = 30) {
  const [state, setState] = useState({ status: 'loading', counts: {}, max: 0 })

  useEffect(() => {
    let cancelled = false

    supabase
      .from('notices_v2')
      .select('region')
      .gte('scraped_at', isoNDaysAgo(lookbackDays))
      .limit(10000)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ status: 'error', counts: {}, max: 0, error: error.message })
          return
        }
        const counts = {}
        for (const row of data || []) {
          if (!row.region) continue
          counts[row.region] = (counts[row.region] || 0) + 1
        }
        const max = Object.values(counts).reduce((a, b) => Math.max(a, b), 0)
        setState({ status: 'ok', counts, max })
      })

    return () => { cancelled = true }
  }, [lookbackDays])

  return state
}
