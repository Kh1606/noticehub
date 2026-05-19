import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'clt-plus.viewMode'
const VALID = new Set(['inventory', 'map'])
const DEFAULT_MODE = 'inventory'

function readInitial() {
  if (typeof window === 'undefined') return DEFAULT_MODE
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return VALID.has(v) ? v : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
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
