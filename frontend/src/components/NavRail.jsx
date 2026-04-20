import { Link, useLocation, useSearchParams } from 'react-router-dom'

function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function IconFire() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 0 1.5 1 2 1.5 2C10.5 7 12 5 12 3z" />
      <path d="M6 15a6 6 0 0 0 12 0" />
    </svg>
  )
}
function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8" />
    </svg>
  )
}
function IconTrend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  )
}
function IconCal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}
function IconPeople() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M15 20c0-2 1.5-3.5 4-3.5s2 1.5 2 3.5" />
    </svg>
  )
}
function IconMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v16M15 6v16" />
    </svg>
  )
}
function IconMortar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 9l10-4 10 4-10 4z" />
      <path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
    </svg>
  )
}
function IconTeam() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

function RailItem({ to, hash, label, Icon, active }) {
  const cls = `flex items-center gap-2.5 px-3 py-2 no-underline text-[0.82rem] font-archivo font-semibold rounded-sm transition-colors ${
    active ? 'bg-offwhite text-navy' : 'text-ink/80 hover:bg-offwhite hover:text-navy'
  }`
  if (hash) {
    return (
      <a href={hash} className={cls}>
        <Icon />
        <span>{label}</span>
      </a>
    )
  }
  return (
    <Link to={to} className={cls}>
      <Icon />
      <span>{label}</span>
    </Link>
  )
}

function RailSection({ title, children }) {
  return (
    <div className="py-1.5">
      <div className="px-3 pt-2 pb-1 font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.14em] text-gray">
        {title}
      </div>
      <div>{children}</div>
    </div>
  )
}

function NavRail() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isHome = (location.pathname === '/' || location.pathname === '/feed')
  const sort = searchParams.get('sort') || 'new'

  return (
    <nav
      className="border border-lightgray bg-card mb-3.5 overflow-hidden"
      aria-label="Site navigation"
    >
      <RailSection title="Navigation">
        <RailItem to="/" label="Home" Icon={IconHome} active={isHome && !searchParams.get('sort')} />
        <RailItem to="/?sort=popular" label="Popular" Icon={IconFire} active={isHome && sort === 'popular'} />
        <RailItem to="/?sort=new" label="New" Icon={IconSparkle} active={isHome && sort === 'new' && searchParams.get('sort')} />
        <RailItem to="/?sort=trending" label="Trending" Icon={IconTrend} active={isHome && sort === 'trending'} />
      </RailSection>
      <div className="border-t border-[#EAE7E0]" />
      <RailSection title="Browse">
        <RailItem hash="#events" label="Events" Icon={IconCal} />
        <RailItem hash="#groups" label="Groups" Icon={IconPeople} />
        <RailItem to="/map" label="Campus Map" Icon={IconMap} active={location.pathname === '/map'} />
        <RailItem to="/professors" label="Professors" Icon={IconMortar} active={location.pathname === '/professors'} />
        <RailItem hash="#team" label="Team" Icon={IconTeam} />
      </RailSection>
    </nav>
  )
}

export default NavRail
