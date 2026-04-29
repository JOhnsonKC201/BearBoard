import { useEffect, useState } from 'react'
import { API_URL } from '../api/client'

const POLL_MS = 30000
const CHECK_TIMEOUT_MS = 8000
// Suppress the badge for the first stretch after mount so a Render cold-boot
// (typically 30-60s) doesn't flash "Reconnecting..." at every visitor on first
// page load. By 10s in, either the boot is done or the wait is real.
const SUPPRESS_MS = 10000

// Lightweight connectivity indicator. When the backend is up this
// component renders nothing - we don't need to tell every visitor the API
// is "Live." It only surfaces when we're offline or reconnecting, with
// human copy instead of a debug word like "Offline."
function HealthDot() {
  const [status, setStatus] = useState('checking') // checking | online | offline
  const [allowBadge, setAllowBadge] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAllowBadge(true), SUPPRESS_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const ctrl = new AbortController()
        const timeout = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS)
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
  if (!allowBadge) return null

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
