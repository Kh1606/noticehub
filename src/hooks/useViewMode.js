import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'clt-plus.viewMode'
const VALID = new Set(['list', 'map'])

function readInitial() {
  if (typeof window === 'undefined') return 'list'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return VALID.has(v) ? v : 'list'
  } catch {
    return 'list'
  }
}

export default function useViewMode() {
  const [viewMode, setViewModeState] = useState(readInitial)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode)
    } catch {
      // ignore quota / private-mode failures
    }
  }, [viewMode])

  const setViewMode = useCallback(next => {
    if (VALID.has(next)) setViewModeState(next)
  }, [])

  return [viewMode, setViewMode]
}
