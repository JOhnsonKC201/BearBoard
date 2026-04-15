import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

function Navbar() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

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
        <input
          type="text"
          className="bg-white/[0.08] border border-white/10 text-white font-franklin text-[0.8rem] py-[7px] px-3.5 rounded outline-none w-[190px] focus:border-gold focus:w-[240px] transition-all placeholder:text-white/30"
          placeholder="Search posts, groups..."
        />
        <Link to="/profile/1" className="w-[30px] h-[30px] bg-gold text-navy rounded flex items-center justify-center font-archivo font-extrabold text-[0.65rem]">
          JK
        </Link>

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
