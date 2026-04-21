import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function IconFeed({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="0.5" />
      <rect x="3" y="10" width="18" height="4" rx="0.5" />
      <rect x="3" y="16" width="18" height="4" rx="0.5" />
    </svg>
  )
}

function IconEvents({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 9h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  )
}

function IconGroups({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M15 20c0-2 1.5-3.5 4-3.5s2 1.5 2 3.5" />
    </svg>
  )
}

function IconMe({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

function Tab({ to, label, Icon, active, onClick }) {
  const body = (
    <>
      {/* Active state uses a gold pill halo behind the icon so the tap
          target has visual weight, not just a color change. */}
      <span
        className={`flex items-center justify-center w-10 h-7 rounded-full transition-colors ${
          active ? 'bg-gold/15 text-gold' : 'text-white/70'
        }`}
      >
        <Icon active={active} />
      </span>
      <span
        className={`font-archivo font-extrabold text-[0.58rem] tracking-[0.08em] uppercase mt-0.5 ${
          active ? 'text-gold' : 'text-white/55'
        }`}
      >
        {label}
      </span>
    </>
  )
  // min-h-[56px] is the iOS / Material bottom-nav standard, well above
  // the 44px tap target floor.
  const cls = 'flex-1 flex flex-col items-center justify-center min-h-[56px] py-1.5 no-underline'
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} bg-transparent border-0 cursor-pointer`} aria-current={active ? 'page' : undefined}>
        {body}
      </button>
    )
  }
  return (
    <Link to={to} className={cls} aria-current={active ? 'page' : undefined}>
      {body}
    </Link>
  )
}

function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthed } = useAuth()

  const isFeed = location.pathname === '/' || location.pathname === '/feed'
  const isMe =
    location.pathname.startsWith('/profile') ||
    (!isAuthed && location.pathname === '/login')
  const meTo = isAuthed && user ? `/profile/${user.id}` : '/login'

  // Scroll to a named section on Home. If the user is already on Home,
  // scroll directly; otherwise navigate then scroll after the route renders.
  const goToSection = (id) => {
    const scroll = () => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (isFeed) {
      scroll()
    } else {
      navigate('/')
      // Wait a tick for Home to mount before trying to find the section.
      setTimeout(scroll, 80)
    }
  }

  const openNewPost = (e) => {
    e.preventDefault()
    if (!isAuthed) {
      navigate('/login')
      return
    }
    // Home.jsx listens for this event and opens the modal. More reliable
    // than query-param ping-pong, which silently no-ops when you tap the
    // + button twice in a row from the same URL.
    window.dispatchEvent(new CustomEvent('bearboard:newpost'))
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 flex items-stretch justify-around z-[150]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary mobile navigation"
    >
      <Tab to="/" label="Feed" Icon={IconFeed} active={isFeed} />
      <Tab
        label="Events"
        Icon={IconEvents}
        active={false}
        onClick={() => goToSection('upcoming')}
      />

      {/* Center + FAB, raised above the bar */}
      <div className="flex-1 flex items-start justify-center relative">
        <button
          type="button"
          onClick={openNewPost}
          aria-label="Create new post"
          className="-translate-y-1/3 w-[52px] h-[52px] bg-gold text-navy rounded-full flex items-center justify-center font-archivo font-black text-2xl leading-none cursor-pointer border-[3px] border-navy shadow-[0_6px_16px_-6px_rgba(0,0,0,0.6)] hover:bg-[#E5A92E] transition-colors active:scale-95 transition-transform"
        >
          +
        </button>
      </div>

      <Tab
        label="Groups"
        Icon={IconGroups}
        active={false}
        onClick={() => goToSection('groups')}
      />
      <Tab to={meTo} label="Me" Icon={IconMe} active={isMe} />
    </nav>
  )
}

export default BottomNav
