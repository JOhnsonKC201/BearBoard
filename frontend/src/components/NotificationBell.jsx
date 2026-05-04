import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { formatRelativeTime } from '../utils/format'

const POLL_MS = 60000

// ---------------------------------------------------------------------------
// Per-kind metadata. Drives the icon, accent color, headline copy, and the
// optional "warning banner" treatment for SOS. The bell used to render every
// notification identically as "New activity · 1 hour ago", which made an SOS
// (a real student needing help right now) look the same as a routine reply.
// This map is the single source of truth — adding a future kind means adding
// one entry here, not hunting through render code.
// ---------------------------------------------------------------------------

const KIND_META = {
  sos: {
    label: 'SOS · Help needed',
    body: 'A student in your major flagged an SOS — they need help right now.',
    accent: 'sos', // → red border, light-red bg when unread, banner styling
    icon: IconSiren,
  },
  report: {
    label: 'Report filed',
    body: 'A post was reported — review it in the Admin Dashboard.',
    accent: 'warning', // → gold/danger blend
    icon: IconFlag,
  },
  resurface: {
    label: 'Quiet post needs eyes',
    body: 'A post from someone in your major is still waiting for an answer.',
    accent: 'gold',
    icon: IconBookmark,
  },
  comment: {
    label: 'New comment',
    body: 'Someone replied on your post.',
    accent: 'navy',
    icon: IconChat,
  },
  reply: {
    label: 'New reply',
    body: 'Someone replied to your comment.',
    accent: 'navy',
    icon: IconChat,
  },
  // Direct-message ping from BearChat. These rows have post_id=null (the
  // notification isn't tied to a post — see _ensure_chat_notification in
  // backend/routers/chat.py) so we send the click straight to the chat inbox.
  chat: {
    label: 'New message',
    body: "You've got a direct message in BearChat.",
    accent: 'navy',
    icon: IconChat,
  },
}

function kindMeta(kind) {
  return KIND_META[kind] || {
    label: 'New activity',
    body: 'Something new on a post you care about.',
    accent: 'neutral',
    icon: IconBell,
  }
}

// Visual recipe per accent — kept colocated with KIND_META so a glance at
// this file tells you exactly how each kind will look. Tailwind classes are
// fully literal (no string templating) so the JIT picks them up.
function accentClasses(accent, unread) {
  switch (accent) {
    case 'sos':
      return {
        leftBorder: 'border-l-[3px] border-l-danger',
        bg: unread ? 'bg-danger-bg' : 'bg-card hover:bg-danger-bg/40',
        iconBg: 'bg-danger text-white',
        labelText: 'text-danger',
      }
    case 'warning':
      return {
        leftBorder: 'border-l-[3px] border-l-gold',
        bg: unread ? 'bg-gold-pale/60' : 'bg-card hover:bg-gold-pale/30',
        iconBg: 'bg-gold text-navy',
        labelText: 'text-[#8B6914]',
      }
    case 'gold':
      return {
        leftBorder: 'border-l-[3px] border-l-gold',
        bg: unread ? 'bg-gold-pale/40' : 'bg-card hover:bg-offwhite',
        iconBg: 'bg-gold text-navy',
        labelText: 'text-navy',
      }
    case 'navy':
      return {
        leftBorder: 'border-l-[3px] border-l-navy',
        bg: unread ? 'bg-gold-pale/40' : 'bg-card hover:bg-offwhite',
        iconBg: 'bg-navy text-gold',
        labelText: 'text-navy',
      }
    default:
      return {
        leftBorder: 'border-l-[3px] border-l-lightgray',
        bg: unread ? 'bg-offwhite' : 'bg-card hover:bg-offwhite/70',
        iconBg: 'bg-lightgray text-ink',
        labelText: 'text-ink',
      }
  }
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
    // Routing per kind: post-tied notifications go to the post detail page;
    // chat notifications (post_id=null by design) go to the chat inbox so
    // tapping the bell isn't a silent no-op when the row is a DM ping.
    if (n.kind === 'chat') {
      navigate('/chat')
    } else if (n.post_id) {
      navigate(`/post/${n.post_id}`)
    }
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

  // Count how many unread SOS notifications we have so we can highlight the
  // bell icon itself when there's an active emergency. Pulled before render
  // so the badge color is decided once.
  const hasUnreadSos = items.some((n) => n.kind === 'sos' && !n.read)

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={togglePanel}
        aria-label="Notifications"
        className={`relative w-10 h-10 text-white rounded flex items-center justify-center text-[1rem] transition-colors ${
          hasUnreadSos
            ? 'bg-danger/30 hover:bg-danger/40 ring-1 ring-danger/60 animate-pulse'
            : 'bg-white/[0.08] hover:bg-white/[0.16]'
        }`}
      >
        <span aria-hidden="true">&#128276;</span>
        {unread > 0 && (
          <span
            key={unread}
            className={`badge-pop absolute -top-1 -right-1 text-[0.55rem] font-archivo font-black rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center leading-none ${
              hasUnreadSos ? 'bg-danger text-white' : 'bg-gold text-navy'
            }`}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[40px] w-[340px] max-w-[calc(100vw-16px)] max-h-[460px] overflow-y-auto bg-card border border-lightgray shadow-lg z-[300]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAE7E0] bg-offwhite sticky top-0 z-[1]">
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
            items.map((n) => {
              const meta = kindMeta(n.kind)
              const accent = accentClasses(meta.accent, !n.read)
              const Icon = meta.icon
              const isSos = meta.accent === 'sos'
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left block px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 cursor-pointer transition-colors ${accent.leftBorder} ${accent.bg}`}
                >
                  {isSos && !n.read && (
                    // Loud banner row above the body — only on unread SOS so
                    // a resolved/read SOS doesn't keep screaming.
                    <div className="flex items-center gap-1.5 mb-1.5 text-danger">
                      <span aria-hidden className="font-archivo font-extrabold text-[0.6rem] uppercase tracking-[0.2em]">
                        ⚠ Urgent
                      </span>
                      <span className="h-px flex-1 bg-danger/30" />
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${accent.iconBg}`}>
                      <Icon />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[0.66rem] font-archivo font-extrabold uppercase tracking-[0.12em] ${accent.labelText}`}>
                        {meta.label}
                      </div>
                      <div className="text-[0.82rem] font-archivo font-bold text-ink leading-snug mt-[2px]">
                        {meta.body}
                      </div>
                      {n.post && (
                        <div className="text-[0.78rem] text-gray truncate italic font-franklin mt-[2px]">
                          "{n.post.title}"
                        </div>
                      )}
                      <div className="text-[0.65rem] text-gray mt-[3px]">{formatRelativeTime(n.created_at)}</div>
                    </div>
                    {!n.read && (
                      <span
                        aria-label="Unread"
                        className={`mt-[6px] w-[7px] h-[7px] rounded-full shrink-0 ${
                          isSos ? 'bg-danger animate-pulse' : 'bg-gold'
                        }`}
                      />
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline icons. Same vocabulary used by ActionIcons + the ReportPostModal so
// a notification's icon visually rhymes with the action that produced it.
// ---------------------------------------------------------------------------

function IconBell() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconSiren() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a6 6 0 0 0-6 6v3H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-2V8a6 6 0 0 0-6-6zm-6 14a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4H6z" />
    </svg>
  )
}

function IconFlag() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21V4a1 1 0 0 1 1-1h11l-2 5 2 5H5" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function IconBookmark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" />
    </svg>
  )
}

export default NotificationBell
