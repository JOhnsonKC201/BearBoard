import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const MONTHS_LONG = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const AVATAR_PALETTE = [
  { bg: 'linear-gradient(135deg, #6B4AA0 0%, #3F2270 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #19314F 0%, #0B1D34 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #2BA89A 0%, #137267 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #D45347 0%, #962E22 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #EAA841 0%, #B47A14 100%)', tc: '#0B1D34' },
  { bg: 'linear-gradient(135deg, #4A8A4D 0%, #234C25 100%)', tc: '#FFFFFF' },
]

const CAT_STYLES = {
  events: 'bg-gold-pale text-[#8B6914]',
  academic: 'bg-[#D1E3F5] text-navy',
  recruiters: 'bg-[#E6D8F0] text-purple',
  social: 'bg-[#D0EDE9] text-[#0F5E54]',
  general: 'bg-[#E5E3DE] text-[#5A5A5A]',
  anonymous: 'bg-[#1A1A1A] text-white',
  housing: 'bg-[#FCE8D2] text-[#8A4B16]',
  swap: 'bg-[#DDE6C5] text-[#4A5A1F]',
  safety: 'bg-[#F5D5D0] text-[#8B1A1A]',
}

function paletteFor(seed) {
  return AVATAR_PALETTE[Math.abs(seed ?? 0) % AVATAR_PALETTE.length]
}

function initialsFor(name) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function formatRelative(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function eventDateParts(iso) {
  if (!iso) return { day: '', month: '' }
  const [y, mo, d] = iso.split('-').map(Number)
  const dt = new Date(y, (mo || 1) - 1, d || 1)
  if (Number.isNaN(dt.getTime())) return { day: '', month: '' }
  return { day: String(dt.getDate()), month: MONTHS_SHORT[dt.getMonth()] }
}

function Avatar({ seed, name, size = 36 }) {
  const pal = paletteFor(seed)
  return (
    <div
      className="rounded-full flex items-center justify-center font-archivo font-extrabold shrink-0"
      style={{ width: size, height: size, background: pal.bg, color: pal.tc, fontSize: size * 0.38 }}
    >
      {initialsFor(name)}
    </div>
  )
}

function CategoryPill({ category }) {
  if (!category) return null
  const key = String(category).toLowerCase()
  const cls = CAT_STYLES[key] || CAT_STYLES.general
  return (
    <span className={`font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.08em] px-2 py-[3px] rounded-sm ${cls}`}>
      {category}
    </span>
  )
}

function MobileHome({ posts = [], trending = [], events = [], loading = false }) {
  const { user, isAuthed } = useAuth()

  const { eyebrow, greeting, firstName } = useMemo(() => {
    const now = new Date()
    const eb = `${WEEKDAYS[now.getDay()]} \u00B7 ${MONTHS_LONG[now.getMonth()]} ${now.getDate()}`
    const h = now.getHours()
    const greet = h < 12 ? 'GOOD MORNING' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'
    const first = (user?.name || '').split(/\s+/).filter(Boolean)[0] || ''
    return { eyebrow: eb, greeting: greet, firstName: first.toUpperCase() }
  }, [user?.name])

  const stats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const newToday = posts.filter((p) => new Date(p.created_at).toDateString() === todayStr).length
    const unread = posts.filter((p) => {
      const t = new Date(p.created_at).getTime()
      return !Number.isNaN(t) && t > dayAgo && (!user || p.author?.id !== user.id)
    }).length
    return { newToday, unread, total: posts.length }
  }, [posts, user])

  const featured = trending[0] || posts[0] || null
  const restPosts = useMemo(() => {
    if (!featured) return posts
    return posts.filter((p) => p.id !== featured.id)
  }, [posts, featured])

  return (
    <div className="lg:hidden bg-offwhite">
      {/* Hero */}
      <section className="bg-navy px-5 pt-5 pb-6 relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-archivo font-bold text-white/55 text-[0.68rem] uppercase tracking-[0.12em]">
              {eyebrow}
            </div>
            <h1 className="font-archivo font-black text-white text-[1.85rem] leading-[1.05] tracking-tight mt-2 uppercase">
              {isAuthed && firstName ? (
                <>
                  {greeting},
                  <br />
                  <span className="text-gold">{firstName}</span>
                </>
              ) : (
                <>
                  WELCOME TO
                  <br />
                  <span className="text-gold">BEARBOARD</span>
                </>
              )}
            </h1>
          </div>
          {isAuthed ? (
            <Link to={`/profile/${user?.id ?? ''}`} className="no-underline shrink-0">
              <Avatar seed={user?.id} name={user?.name} size={44} />
            </Link>
          ) : (
            <Link
              to="/login"
              className="bg-gold text-navy text-[0.68rem] font-archivo font-extrabold uppercase tracking-wide px-3 py-[7px] rounded-sm no-underline shrink-0"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Stats strip */}
        <div className="flex items-start gap-6 mt-5">
          <div>
            <div className="font-archivo font-black text-gold text-[1.35rem] leading-none">{stats.newToday}</div>
            <div className="font-archivo font-bold text-white/55 text-[0.58rem] uppercase tracking-[0.12em] mt-1">New today</div>
          </div>
          <div>
            <div className="font-archivo font-black text-gold text-[1.35rem] leading-none">{stats.unread}</div>
            <div className="font-archivo font-bold text-white/55 text-[0.58rem] uppercase tracking-[0.12em] mt-1">Unread</div>
          </div>
          <div>
            <div className="font-archivo font-black text-gold text-[1.35rem] leading-none">{stats.total}</div>
            <div className="font-archivo font-bold text-white/55 text-[0.58rem] uppercase tracking-[0.12em] mt-1">Posts</div>
          </div>
        </div>
      </section>

      {/* Gold divider */}
      <div className="h-[3px] bg-gold" />

      {/* Featured TOP TODAY card */}
      {featured && (
        <section className="px-4 pt-5">
          <Link
            to={`/post/${featured.id}`}
            className="block no-underline text-white bg-navy relative overflow-hidden"
            style={{
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 14px)',
            }}
          >
            <div className="px-5 pt-5 pb-5">
              <div className="flex items-center gap-2">
                <span className="font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.1em] px-2 py-[3px] bg-gold text-navy rounded-sm">
                  Top today
                </span>
                {featured.category && <CategoryPill category={featured.category} />}
              </div>
              <h2 className="font-archivo font-black text-[1.55rem] leading-[1.1] tracking-tight uppercase mt-3">
                {featured.title}
              </h2>
              {featured.body && (
                <p className="text-white/70 text-[0.88rem] leading-snug mt-3 line-clamp-2">
                  {featured.body}
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar seed={featured.author?.id ?? featured.id} name={featured.author?.name} size={32} />
                  <div className="min-w-0">
                    <div className="font-archivo font-bold text-[0.78rem] truncate">
                      {featured.author?.name || 'Unknown'}
                    </div>
                    <div className="text-white/50 text-[0.68rem]">{formatRelative(featured.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[0.78rem] shrink-0">
                  <span className="flex items-center gap-1 text-gold font-archivo font-extrabold">
                    <span aria-hidden>▲</span>
                    {featured.upvote_count ?? featured.upvotes ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-white/70 font-archivo font-extrabold">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {featured.comment_count ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Upcoming at Morgan */}
      <section className="mt-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <h3 className="font-archivo font-extrabold text-[0.78rem] uppercase tracking-[0.1em] text-ink">
            Upcoming at <span className="text-gold">Morgan</span>
          </h3>
          <a href="#events" className="font-archivo font-extrabold text-[0.68rem] uppercase tracking-wide text-navy no-underline">
            All <span aria-hidden>→</span>
          </a>
        </div>
        {events.length === 0 ? (
          <div className="px-4 py-3 text-[0.78rem] text-gray">
            {loading ? 'Loading events…' : 'No upcoming events.'}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
            {events.map((ev) => {
              const { day, month } = eventDateParts(ev.event_date)
              const detail = [ev.location, ev.start_time].filter(Boolean).join(' \u00B7 ')
              return (
                <a
                  key={ev.id}
                  href={ev.source_url || '#events'}
                  target={ev.source_url ? '_blank' : undefined}
                  rel={ev.source_url ? 'noreferrer' : undefined}
                  className="snap-start shrink-0 w-[240px] bg-white border border-lightgray no-underline text-ink"
                >
                  <div className="flex items-stretch">
                    <div className="bg-navy text-white font-archivo font-black text-[1.15rem] px-4 py-3 flex items-baseline gap-1">
                      <span className="leading-none">{day || '?'}</span>
                      <span className="text-gold text-[0.62rem] uppercase tracking-widest font-extrabold">{month}</span>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="font-archivo font-bold text-[0.88rem] leading-snug line-clamp-2">{ev.title}</div>
                    {detail && (
                      <div className="text-gray text-[0.72rem] mt-1 truncate">{detail}</div>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* More on the board */}
      <section className="mt-6 pb-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <h3 className="font-archivo font-extrabold text-[0.78rem] uppercase tracking-[0.1em] text-ink">
            More on the board
          </h3>
          <a href="#feed" className="font-archivo font-extrabold text-[0.68rem] uppercase tracking-wide text-gray no-underline">
            Filter
          </a>
        </div>

        {loading && restPosts.length === 0 ? (
          <div className="px-4 py-6 text-[0.82rem] text-gray">Loading posts…</div>
        ) : restPosts.length === 0 ? (
          <div className="px-4 py-6 text-[0.82rem] text-gray">No posts yet.</div>
        ) : (
          <ul className="px-4 space-y-2">
            {restPosts.map((post) => (
              <li key={post.id} className="bg-white border border-lightgray">
                <Link to={`/post/${post.id}`} className="flex items-stretch no-underline text-ink">
                  {/* Vote column */}
                  <div className="bg-offwhite flex flex-col items-center justify-center px-2 py-2 border-r border-lightgray w-[44px] shrink-0">
                    <span className="text-gray text-[0.8rem] leading-none">▲</span>
                    <span className="font-archivo font-black text-navy text-[0.95rem] leading-tight my-[2px]">
                      {post.upvote_count ?? post.upvotes ?? 0}
                    </span>
                    <span className="text-gray text-[0.8rem] leading-none">▼</span>
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      {post.category && <CategoryPill category={post.category} />}
                      <span className="text-gray text-[0.7rem] truncate">
                        {post.author?.name || 'Anon'} <span aria-hidden>&middot;</span> {formatRelative(post.created_at)}
                      </span>
                    </div>
                    <div className="font-archivo font-bold text-[0.92rem] leading-snug line-clamp-2">
                      {post.title}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default MobileHome
