import { useEffect, useState } from 'react'
import { API_URL } from '../api/client'

const POLL_MS = 30000

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

  const config = {
    checking: { color: 'bg-gold', label: 'Checking API…', pulse: true },
    online: { color: 'bg-[#4CAF50]', label: 'API online', pulse: true },
    offline: { color: 'bg-[#C0392B]', label: 'API offline', pulse: false },
  }[status]

  return (
    <div
      className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded text-white/55 text-[0.6rem] font-archivo font-bold uppercase tracking-wider"
      title={config.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.color} ${config.pulse ? 'status-dot' : ''}`} />
      <span>{status === 'offline' ? 'Offline' : status === 'checking' ? '…' : 'Live'}</span>
    </div>
  )
}

export default HealthDot
