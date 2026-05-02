import { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch, invalidateCache } from '../api/client'

const TOKEN_KEY = 'bearboard_token'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    apiFetch('/api/auth/me')
      .then((data) => {
        if (cancelled) return
        // Render with what we have RIGHT NOW. The streak number on screen
        // is correct unless the user is logging in for the first time
        // today, in which case the background checkin a few lines down
        // will bump it within a second.
        setUser(data)
        setLoading(false)

        // Fire-and-forget daily checkin so streaks count on a passive
        // visit. Then refresh /me to update the streak count in the
        // navbar. Both happen in the background — they do NOT block the
        // initial paint, which was the old behavior and added ~400 ms to
        // the time-to-first-render on every page load.
        ;(async () => {
          try {
            await apiFetch('/api/users/me/checkin', { method: 'POST' })
            const fresh = await apiFetch('/api/auth/me', { cache: false })
            if (!cancelled) setUser(fresh)
          } catch {
            // Background work; surface nothing to the user.
          }
        })()
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
        setUser(null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  const login = async (email, password) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setToken(data.access_token)
    return data
  }

  const register = async (payload) => {
    await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return login(payload.email, payload.password)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    // Drop the persisted GET cache so the previous user's posts/profile
    // don't sit in localStorage after sign-out. Different account on the
    // same device shouldn't be able to peek at what was cached.
    invalidateCache()
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    setUser, // exposed so profile edits can update the navbar avatar immediately
    token,
    loading,
    login,
    register,
    logout,
    isAuthed: Boolean(token),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
