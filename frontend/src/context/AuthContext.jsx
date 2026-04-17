import { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

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
      .then((data) => { if (!cancelled) setUser(data) })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
        setUser(null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
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
    setToken(null)
    setUser(null)
  }

  const value = { user, token, loading, login, register, logout, isAuthed: Boolean(token) }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
