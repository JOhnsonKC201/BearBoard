import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import HealthDot from './HealthDot'
import { LogoIcon } from './Logo'
import { useAuth } from '../context/AuthContext'

function initialsFor(name) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

// Primary top-nav items. Each is a real route — no hash-to-section
// navigation, so every nav button lands on its own page with its own URL.
const PRIMARY_LINKS = [
  { to: '/',            label: 'Feed' },
  { to: '/groups',      label: 'Groups' },
  { to: '/chat',        label: 'Chat' },
  { to: '/events',      label: 'Events' },
  { to: '/map',         label: 'Map' },
  { to: '/professors',  label: 'Profs' },
  { to: '/leaderboard', label: 'Board' },
  { to: '/team',        label: 'Team' },
]

// Items tucked into a "More" dropdown so the top bar doesn't get crowded
// but every content page is still reachable from the header.
const MORE_LINKS = [
  { to: '/welcome',    label: 'Welcome & FAQ' },
  { to: '/stats',      label: 'Site stats' },
  { to: '/resources',  label: 'Campus resources' },
  { to: '/crosslinks', label: 'Related communities' },
  { to: '/rules',      label: 'House rules' },
  { to: '/anonymity',  label: 'Anonymity guide' },
]


function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthed, logout } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') || '')
  const moreRef = useRef(null)

  // Debounced search → URL param so Home picks it up without firing a
  // fetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      const current = searchParams.get('q') || ''
      if (searchDraft === current) return
      const next = new URLSearchParams(searchParams)
      if (searchDraft.trim()) next.set('q', searchDraft.trim())
      else next.delete('q')
      setSearchParams(next, { replace: true })
    }, 200)
    return () => clearTimeout(id)
  }, [searchDraft])  // eslint-disable-line react-hooks/exhaustive-deps

  // Close "More" on outside click or Esc.
  useEffect(() => {
    if (!moreOpen) return
    const onClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // Close "More" automatically when the user navigates.
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  const onSearchSubmit = (e) => {
    e.preventDefault()
    if (location.pathname !== '/' && location.pathname !== '/feed') navigate('/')
  }

  const isActive = (link) => {
    if (link.to === '/' && (location.pathname === '/' || location.pathname === '/feed')) return true
    // Treat sub-pages as still under the parent (e.g. /groups/123 highlights
    // the Groups tab) — except for /, which is matched explicitly above.
    if (link.to !== '/' && location.pathname.startsWith(link.to)) return true
    return false
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-navy h-[60px] flex items-center justify-between px-6 sticky top-0 z-[100]">
      <Link
        to="/"
        className="inline-flex items-center gap-3 font-archivo font-black text-[1.3rem] text-white no-underline tracking-tight uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-sm"
        aria-label="BearBoard home"
      >
        <LogoIcon size={40} />
        <span className="leading-none inline-flex items-baseline">
          <span>BEAR</span>
          <span className="text-gold inline-block">BOARD</span>
        </span>
      </Link>

      {/* Desktop nav links (lg+; bottom nav covers smaller screens) */}
      <div className="hidden lg:flex items-center gap-[2px]">
        {PRIMARY_LINKS.map((link) => {
          const baseCls = `text-[0.78rem] font-semibold px-3 py-1.5 rounded no-underline uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
            isActive(link)
              ? 'text-gold bg-white/[0.06]'
              : 'text-white/55 hover:text-white hover:bg-white/[0.04]'
          }`
          // Hash links use react-router <Link to="/#target"> — this both
          // navigates to / and sets location.hash so Home.jsx can scroll.
          return (
            <Link key={link.label} to={link.to} className={baseCls}>
              {link.label}
            </Link>
          )
        })}

        {/* More dropdown — holds every page that doesn't fit the primary row. */}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={`text-[0.78rem] font-semibold px-3 py-1.5 rounded no-underline uppercase tracking-wide transition-colors bg-transparent border-none cursor-pointer inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
              moreOpen
                ? 'text-gold bg-white/[0.06]'
                : 'text-white/55 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            More
            <svg width="9" height="9" viewBox="0 0 10 10" className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          {moreOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] w-[220px] bg-navy border border-gold/25 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] overflow-hidden z-[110]"
            >
              <div className="h-[2px] bg-gold w-full" aria-hidden />
              {MORE_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  role="menuitem"
                  className="block px-4 py-2.5 text-[0.78rem] font-archivo font-semibold text-white/75 hover:text-gold hover:bg-white/[0.05] no-underline transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <HealthDot />

        {/* Mobile (below sm): icon-only search button that flips a full-
            width search sheet under the navbar. Desktop: always-visible
            inline input. */}
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label={searchOpen ? 'Close search' : 'Open search'}
          aria-expanded={searchOpen}
          className="sm:hidden w-10 h-10 flex items-center justify-center rounded bg-white/[0.08] border border-white/10 text-white/80 hover:text-white cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </button>

        <form onSubmit={onSearchSubmit} className="hidden sm:block">
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="bg-white/[0.08] border border-white/10 text-white font-franklin text-[0.8rem] py-[7px] px-3.5 rounded outline-none w-[170px] lg:w-[200px] lg:focus:w-[260px] transition-all placeholder:text-white/30"
            placeholder="Search posts..."
            aria-label="Search posts"
          />
        </form>

        {isAuthed ? (
          <>
            {user?.streak_count > 0 && (
              <div
                className="hidden lg:flex items-center gap-1 px-2 py-1 rounded bg-gold/15 text-gold text-[0.7rem] font-archivo font-extrabold"
                title={`${user.streak_count}-day activity streak`}
              >
                <span aria-hidden="true">🔥</span>
                <span>{user.streak_count}</span>
              </div>
            )}
            <NotificationBell />
            {user && (
              <Link
                to={`/profile/${user.id}`}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded hover:bg-white/[0.08] transition-colors no-underline"
                aria-label={`Open ${user.name || 'your'} profile`}
              >
                {user.avatar_url ? (
                  <span className="w-9 h-9 lg:w-8 lg:h-8 rounded-full overflow-hidden ring-1 ring-gold/40 bg-gold/20 block">
                    <img
                      src={user.avatar_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-cover block"
                    />
                  </span>
                ) : (
                  <span className="w-9 h-9 lg:w-8 lg:h-8 bg-gold text-navy rounded-full flex items-center justify-center font-archivo font-extrabold text-[0.72rem] lg:text-[0.68rem]">
                    {initialsFor(user?.name)}
                  </span>
                )}
                <span className="hidden lg:inline text-white font-archivo font-bold text-[0.78rem] tracking-tight max-w-[140px] truncate">
                  {user.name}
                </span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="hidden md:flex w-9 h-9 lg:w-8 lg:h-8 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/10 cursor-pointer"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 17l5-5-5-5" />
                <path d="M20 12H9" />
                <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="text-white/70 hover:text-white text-[0.72rem] font-archivo font-extrabold uppercase tracking-wide px-3 py-2.5 lg:py-[7px] no-underline"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="bg-gold text-navy text-[0.72rem] font-archivo font-extrabold uppercase tracking-wide px-3 py-2.5 lg:py-[7px] no-underline hover:bg-[#E5A92E] transition-colors"
            >
              Join
            </Link>
          </div>
        )}

      </div>

      {/* Mobile search sheet - full-width input that drops below the
          navbar when the icon button is tapped. */}
      {searchOpen && (
        <div className="sm:hidden absolute left-0 right-0 top-[60px] bg-navy border-t border-white/10 px-4 py-3 z-[90]">
          <form
            onSubmit={(e) => {
              onSearchSubmit(e)
              setSearchOpen(false)
            }}
          >
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              autoFocus
              className="w-full bg-white/[0.08] border border-white/10 text-white font-franklin text-[0.95rem] py-3 px-4 rounded outline-none placeholder:text-white/30"
              placeholder="Search posts..."
              aria-label="Search posts"
            />
          </form>
        </div>
      )}
    </nav>
  )
}

export default Navbar
