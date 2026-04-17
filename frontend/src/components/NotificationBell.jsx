import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'

const POLL_MS = 60000

function formatRelative(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function bodyForKind(kind) {
  if (kind === 'resurface') return 'A post from someone in your major needs answers'
  return 'New activity'
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [authed, setAuthed] = useState(Boolean(localStorage.getItem('bearboard_token')))
  const containerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onStorage = () => setAuthed(Boolean(localStorage.getItem('bearboard_token')))
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refreshCount = async () => {
    if (!authed) {
      setUnread(0)
      return
    }
    try {
      const data = await apiFetch('/api/notifications/unread_count')
      setUnread(data.unread ?? 0)
    } catch (err) {
      if (err.status === 401) setUnread(0)
    }
  }

  useEffect(() => {
    refreshCount()
    if (!authed) return
    const t = setInterval(refreshCount, POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const loadItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/api/notifications/?limit=20')
      setItems(data)
    } catch (err) {
      setError(err.status === 401 ? 'Log in to see notifications' : (err.message || 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }

  const togglePanel = () => {
    const next = !open
    setOpen(next)
    if (next) loadItems()
  }

  const handleClick = async (n) => {
    setOpen(false)
    if (!n.read) {
      setUnread((c) => Math.max(0, c - 1))
      apiFetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {})
    }
    if (n.post_id) navigate(`/post/${n.post_id}`)
  }

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' })
      setUnread(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      /* swallow */
    }
  }

  if (!authed) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={togglePanel}
        aria-label="Notifications"
        className="relative w-[30px] h-[30px] bg-white/[0.08] hover:bg-white/[0.16] text-white rounded flex items-center justify-center text-[0.95rem] transition-colors"
      >
        <span aria-hidden="true">&#128276;</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-gold text-navy text-[0.55rem] font-archivo font-black rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[40px] w-[320px] max-h-[420px] overflow-y-auto bg-card border border-lightgray shadow-lg z-[300]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAE7E0] bg-offwhite sticky top-0">
            <h3 className="font-archivo font-extrabold text-[0.78rem] uppercase tracking-tight">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="bg-transparent border-none text-[0.65rem] text-gray hover:text-ink font-archivo font-bold uppercase tracking-wide cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div className="px-4 py-6 text-center text-gray text-[0.82rem]">Loading…</div>
          ) : error ? (
            <div className="px-4 py-6 text-center text-[#8B1A1A] text-[0.82rem] font-archivo font-bold">{error}</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray text-[0.82rem]">No notifications yet.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left block px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 cursor-pointer transition-colors hover:bg-offwhite ${
                  n.read ? '' : 'bg-gold-pale/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-[6px] w-[6px] h-[6px] bg-gold rounded-full shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.78rem] font-archivo font-bold text-ink leading-snug">
                      {bodyForKind(n.kind)}
                    </div>
                    {n.post && (
                      <div className="text-[0.78rem] text-gray truncate">{n.post.title}</div>
                    )}
                    <div className="text-[0.65rem] text-gray mt-[2px]">{formatRelative(n.created_at)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
