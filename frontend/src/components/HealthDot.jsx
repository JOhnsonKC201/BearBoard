import { useEffect, useState } from 'react'
import { API_URL } from '../api/client'

const POLL_MS = 30000

// Lightweight connectivity indicator. When the backend is up this
// component renders nothing — we don't need to tell every visitor the API
// is "Live." It only surfaces when we're offline or reconnecting, with
// human copy instead of a debug word like "Offline."
function HealthDot() {
  const [status, setStatus] = useState('checking') // checking | online | offline

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const ctrl = new AbortController()
        const timeout = setTimeout(() => ctrl.abort(), 4000)
        const res = await fetch(`${API_URL}/health`, { signal: ctrl.signal })
        clearTimeout(timeout)
        if (cancelled) return
        setStatus(res.ok ? 'online' : 'offline')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }
    check()
    const t = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (status === 'online') return null

  const label = status === 'offline' ? 'Reconnecting...' : 'Connecting...'
  const dot = status === 'offline' ? 'bg-danger' : 'bg-gold'

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-white/70 text-[0.6rem] font-archivo font-bold uppercase tracking-wider"
      title={label}
      role="status"
      aria-live="polite"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot} status-dot`} />
      <span>{label}</span>
    </div>
  )
}

export default HealthDot
