import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

// Auth status flow:
//   'loading'         — initial session check in flight
//   'unauthenticated' — no session
//   'authenticated'   — session present (profile may still be loading on first paint)
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, is_admin')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.warn('profile fetch failed:', error.message)
      return null
    }
    return data
  }, [])

  useEffect(() => {
    let cancelled = false

    // Supabase's getSession() can hang indefinitely when the persisted refresh
    // token is stale (no error thrown). Race it against a 5s timeout — if the
    // client doesn't respond by then, treat the session as dead, clear local
    // auth state, and let the user log in fresh. Without this the whole app
    // sits in 'loading' forever and queries never resolve.
    const sessionRace = Promise.race([
      supabase.auth.getSession().then(r => ({ kind: 'ok', data: r.data })),
      new Promise(resolve => setTimeout(
        () => resolve({ kind: 'timeout' }),
        5000,
      )),
    ])

    sessionRace.then(async (result) => {
      if (cancelled) return
      if (result.kind === 'timeout') {
        // The supabase JS client instance is created once at module load.
        // When its internal state is wedged, clearing localStorage alone
        // isn't enough — subsequent signIn calls share the same broken
        // client and hang too. A fresh page load creates a new client.
        // sessionStorage guard prevents a reload loop if Supabase is truly
        // unreachable (e.g. project paused).
        const alreadyTried = window.sessionStorage.getItem('auth_reset_done')
        if (!alreadyTried) {
          console.warn('[auth] getSession() timed out — clearing session and reloading')
          try {
            for (const key of Object.keys(window.localStorage)) {
              if (key.startsWith('sb-')) window.localStorage.removeItem(key)
            }
            window.sessionStorage.setItem('auth_reset_done', '1')
          } catch (e) {
            console.warn('[auth] localStorage cleanup failed', e)
          }
          window.location.reload()
          return
        }
        // Already tried reloading; treat as unauthenticated and let the
        // user click around (likely they hit the login page).
        console.warn('[auth] still timing out after reset — Supabase may be unreachable')
        if (!cancelled) {
          setUser(null)
          setProfile(null)
          setStatus('unauthenticated')
        }
        return
      }
      const u = result.data.session?.user ?? null
      setUser(u)
      if (u) setProfile(await fetchProfile(u.id))
      if (!cancelled) setStatus(u ? 'authenticated' : 'unauthenticated')
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      // A successful sign-in proves the client is healthy; clear the
      // "we already reloaded once" guard so a future wedge can be auto-fixed.
      if (event === 'SIGNED_IN') {
        try { window.sessionStorage.removeItem('auth_reset_done') } catch {}
      }
      const u = session?.user ?? null
      setUser(u)
      setProfile(u ? await fetchProfile(u.id) : null)
      if (!cancelled) setStatus(u ? 'authenticated' : 'unauthenticated')
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = {
    user,
    profile,
    status,
    isAdmin: !!profile?.is_admin,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
