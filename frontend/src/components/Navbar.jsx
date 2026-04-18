import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import HealthDot from './HealthDot'
import { useAuth } from '../context/AuthContext'

function initialsFor(name) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthed, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const navLinks = [
    { to: '/', label: 'Feed', hash: '#feed' },
    { to: '/', label: 'Groups', hash: '#groups' },
    { to: '/', label: 'Events', hash: '#events' },
    { to: '/', label: 'Team', hash: '#team' },
  ]

  const isActive = (label) => {
    if (label === 'Feed' && location.pathname === '/') return true
    return false
  }

  const handleLogout = () => {
    logout()
    setProfileMenuOpen(false)
    navigate('/login')
  }

  return (
    <nav className="bg-navy h-[52px] flex items-center justify-between px-6 sticky top-0 z-[100]">
      <Link to="/" className="font-archivo font-black text-[1.15rem] text-white no-underline tracking-tight uppercase">
        BEAR<span className="text-gold">BOARD</span>
      </Link>

      {/* Desktop nav links */}
      <div className="hidden md:flex gap-[2px]">
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.hash}
            className={`text-[0.78rem] font-semibold px-3 py-1.5 rounded no-underline uppercase tracking-wide transition-colors ${
              isActive(link.label)
                ? 'text-gold bg-white/[0.06]'
                : 'text-white/55 hover:text-white'
            }`}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <HealthDot />
        <input
          type="text"
          className="bg-white/[0.08] border border-white/10 text-white font-franklin text-[0.8rem] py-[7px] px-3.5 rounded outline-none w-[190px] focus:border-gold focus:w-[240px] transition-all placeholder:text-white/30"
          placeholder="Search posts, groups..."
        />

        {isAuthed ? (
          <>
            {user?.streak_count > 0 && (
              <div
                className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-gold/15 text-gold text-[0.7rem] font-archivo font-extrabold"
                title={`${user.streak_count}-day activity streak`}
              >
                <span aria-hidden="true">🔥</span>
                <span>{user.streak_count}</span>
              </div>
            )}
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="w-[30px] h-[30px] bg-gold text-navy rounded flex items-center justify-center font-archivo font-extrabold text-[0.65rem] cursor-pointer"
                aria-label="Account menu"
              >
                {initialsFor(user?.name)}
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-[40px] w-[180px] bg-card border border-lightgray shadow-lg z-[300]">
                  {user && (
                    <Link
                      to={`/profile/${user.id}`}
                      onClick={() => setProfileMenuOpen(false)}
                      className="block px-4 py-2.5 text-[0.82rem] font-archivo font-semibold text-ink no-underline hover:bg-offwhite border-b border-[#EAE7E0]"
                    >
                      My Profile
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left bg-transparent border-none px-4 py-2.5 text-[0.82rem] font-archivo font-semibold text-ink hover:bg-offwhite cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="text-white/70 hover:text-white text-[0.72rem] font-archivo font-extrabold uppercase tracking-wide px-3 py-[7px] no-underline"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="bg-gold text-navy text-[0.72rem] font-archivo font-extrabold uppercase tracking-wide px-3 py-[7px] no-underline hover:bg-[#E5A92E] transition-colors"
            >
              Join
            </Link>
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          className="md:hidden bg-transparent border-none text-white text-xl cursor-pointer ml-1"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '\u2715' : '\u2630'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-[52px] left-0 right-0 bg-navy border-t border-white/10 flex flex-col p-4 gap-2 md:hidden z-[100]">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.hash}
              onClick={() => setMenuOpen(false)}
              className="text-white/55 hover:text-white text-[0.85rem] font-semibold px-3 py-2 no-underline uppercase tracking-wide"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}

export default Navbar
