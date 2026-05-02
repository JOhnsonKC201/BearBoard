import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SafetyBox from './SafetyBox'
import MobilePostCard from './MobilePostCard'
import FloatingParticles from './FloatingParticles'
import { paletteFor, catClassFor, flairLabel } from '../utils/avatar'
import {
  initialsFor,
  formatRelativeShort as formatRelative,
  eventDateParts,
} from '../utils/format'
import { safeHref } from '../utils/safeUrl'

// =============================================================================
// MobileHome - "Campus Broadsheet"
//
// A vertical student newspaper for Morgan State. The design leans into
// editorial / broadsheet cues: a masthead with volume + date flag, oversized
// gold section numerals running down the left margin, full-bleed featured
// article, and tight 1px dividers for rhythm instead of boxy cards.
//
// Hard constraints (from the surrounding project):
//   - Palette: navy + gold + offwhite + divider tokens only (category pills
//     keep their soft muted fills; category is content, not chrome).
//   - Fonts: Archivo for display / labels, Libre Franklin for body.
//   - 44px+ touch targets, mobile-only (lg:hidden wrapper preserved).
//   - No drop shadows - depth comes from gradients, rules, and scale.
//
// Everything in this file is mobile (<1024px). Desktop is untouched.
// =============================================================================

const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_LONG = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

// -----------------------------------------------------------------------------
// Small UI primitives used within this file only
// -----------------------------------------------------------------------------

function Avatar({ seed, name, avatarUrl, size = 40, ring = false }) {
  const pal = paletteFor(seed)
  const ringClass = ring ? 'ring-2 ring-gold ring-offset-[3px] ring-offset-navy' : ''
  if (avatarUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden shrink-0 ${ringClass}`}
        style={{ width: size, height: size, background: pal.bg }}
      >
        <img
          src={avatarUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="w-full h-full object-cover block"
        />
      </div>
    )
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center font-archivo font-extrabold shrink-0 ${ringClass}`}
      style={{
        width: size,
        height: size,
        background: pal.bg,
        color: pal.tc,
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {initialsFor(name)}
    </div>
  )
}

function CategoryPill({ category, inverse = false }) {
  if (!category) return null
  // Render "Lost & Found" instead of the raw "lostfound" slug we send
  // to the backend. flairLabel falls back to the original string if the
  // slug isn't in the registered set.
  const label = flairLabel(category)
  // On dark surfaces we swap to a transparent gold-outlined pill so the
  // muted category fills don't fight the navy backdrop.
  if (inverse) {
    return (
      <span className="font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.14em] px-2 py-[3px] border border-gold/60 text-gold">
        {label}
      </span>
    )
  }
  return (
    <span
      className={`font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.1em] px-2 py-[3px] ${catClassFor(category)}`}
    >
      {label}
    </span>
  )
}

// Section header with an oversized gold numeral that doubles as a visual
// anchor. The numeral sits baseline-aligned with the title; a thin rule
// extends to the right so each section reads like a folio line.
function SectionFolio({ num, title, action }) {
  return (
    <header className="flex items-end gap-3 px-5 pt-8 pb-3">
      <span
        className="font-archivo font-black text-gold leading-none tracking-[-0.04em] select-none"
        style={{ fontSize: '2.15rem' }}
        aria-hidden
      >
        {String(num).padStart(2, '0')}
      </span>
      <h2 className="font-archivo font-black text-[0.82rem] uppercase tracking-[0.18em] text-ink leading-none pb-1">
        {title}
      </h2>
      <div className="flex-1 h-[1px] bg-ink/10 self-center mb-1" />
      {action && <div className="pb-1">{action}</div>}
    </header>
  )
}

function MetaDot() {
  return <span className="text-ink/25" aria-hidden>·</span>
}

// SVG icons - inline so color inherits and there's no emoji-render drift.
function IconArrowUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <path d="M5 2 L8.5 7.5 L1.5 7.5 Z" />
    </svg>
  )
}
function IconChatSm() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" />
    </svg>
  )
}
function IconArrowRight() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

function MobileHome({
  posts = [],
  trending = [],
  events = [],
  groups = [],
  myGroupIds,
  onToggleMembership,
  onCreateGroup,
  onPostUpdated,
  onPostDeleted,
  loading = false,
}) {
  const { user, isAuthed } = useAuth()

  // Date masthead values: "TUE · APRIL 22 · 2026" + "VOL. SPRING - ISSUE 113".
  // Issue number is a stable offset from Jan 1 so it feels like a running
  // newspaper count without needing real CMS data.
  const masthead = useMemo(() => {
    const now = new Date()
    const weekday = WEEKDAY_SHORT[now.getDay()]
    const month = MONTH_LONG[now.getMonth()]
    const dayNum = now.getDate()
    const year = now.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const issue = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1
    const h = now.getHours()
    const greeting = h < 5 ? 'UP LATE' : h < 12 ? 'GOOD MORNING' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'
    const first = (user?.name || '').split(/\s+/).filter(Boolean)[0] || ''
    return {
      weekday,
      month,
      dayNum,
      year,
      issue,
      greeting,
      firstName: first.toUpperCase(),
    }
  }, [user?.name])

  const stats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const newToday = posts.filter(
      (p) => new Date(p.created_at).toDateString() === todayStr,
    ).length
    const unread = posts.filter((p) => {
      const t = new Date(p.created_at).getTime()
      return !Number.isNaN(t) && t > dayAgo && (!user || p.author?.id !== user.id)
    }).length
    return { newToday, unread, total: posts.length }
  }, [posts, user])

  // Build the Top Stories carousel. Use the trending list when we have
  // enough of it, otherwise fall back to the newest posts. Cap at 5 so
  // the reader isn't swiping through forever to reach the rest of the feed.
  const topStories = useMemo(() => {
    const pool = trending.length >= 3 ? trending : posts
    return pool.slice(0, 5).filter(Boolean)
  }, [trending, posts])
  const featured = topStories[0] || null
  const topIds = useMemo(() => new Set(topStories.map((p) => p.id)), [topStories])
  const restTrending = useMemo(() => {
    const list = trending.length ? trending : posts
    return list.filter((p) => !topIds.has(p.id)).slice(0, 5)
  }, [trending, posts, topIds])
  const moreOnBoard = useMemo(() => {
    return posts.filter((p) => !topIds.has(p.id)).slice(0, 20)
  }, [posts, topIds])

  return (
    <div className="lg:hidden bg-offwhite">
      {/* ===========================================================
          MASTHEAD - broadsheet flag + date + greeting + stats
          =========================================================== */}
      <section className="relative bg-navy text-white overflow-hidden">
        {/* Diagonal halftone texture (very low opacity) */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 8px)',
          }}
          aria-hidden
        />
        {/* Corner gold glow */}
        <div
          className="absolute -bottom-28 -right-20 w-[320px] h-[320px] rounded-full bg-gold/15 blur-3xl pointer-events-none"
          aria-hidden
        />

        {/* Floating gold particles — same atmosphere as the desktop and
            auth heroes, scaled down a bit for the narrower mobile masthead. */}
        <FloatingParticles count={14} seed={2027} />

        <div className="relative px-5 pt-6 pb-7">
          {/* Flag line: masthead + volume/issue */}
          <div className="flex items-center justify-between font-archivo font-extrabold text-[0.56rem] uppercase tracking-[0.24em] text-white/55 pb-3 border-b border-white/15">
            <span>
              BEAR<span className="text-gold">BOARD</span>
              <span className="text-white/30"> - MORGAN STATE</span>
            </span>
            <span>No. {masthead.issue}</span>
          </div>

          {/* Date line */}
          <div className="pt-4 flex items-baseline gap-2">
            <span className="text-gold font-archivo font-black text-[0.92rem] tracking-[0.04em]">
              {masthead.weekday}
            </span>
            <span className="text-white/45 font-archivo font-bold text-[0.66rem] uppercase tracking-[0.16em]">
              {masthead.month} {masthead.dayNum}, {masthead.year}
            </span>
          </div>

          {/* Greeting + avatar */}
          <div className="mt-3 flex items-start justify-between gap-3">
            <h1
              className="font-archivo font-black uppercase tracking-[-0.02em] leading-[0.92] min-w-0 flex-1"
              style={{ fontSize: 'clamp(1.85rem, 8.5vw, 2.55rem)' }}
            >
              {isAuthed && masthead.firstName ? (
                <>
                  {masthead.greeting},
                  <span className="block text-gold mt-1">{masthead.firstName}</span>
                </>
              ) : (
                <>
                  WHAT&rsquo;S
                  <span className="block text-gold mt-1">HAPPENING</span>
                </>
              )}
            </h1>

            {isAuthed ? (
              <Link
                to={`/profile/${user?.id ?? ''}`}
                className="no-underline shrink-0 mt-1"
                aria-label="Open your profile"
              >
                <Avatar seed={user?.id} name={user?.name} avatarUrl={user?.avatar_url} size={52} ring />
              </Link>
            ) : (
              <Link
                to="/login"
                className="shrink-0 mt-1 bg-gold text-navy text-[0.68rem] font-archivo font-extrabold uppercase tracking-[0.12em] px-3 py-2.5 no-underline min-h-[44px] flex items-center"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Stats ledger - separated by thin vertical rules (no gaps),
              numerals in gold, labels in small caps. */}
          <dl className="mt-6 grid grid-cols-3 border-t border-white/15 pt-4">
            <StatCell value={stats.newToday} label="New today" />
            <StatCell value={stats.unread} label="Unread" divider />
            <StatCell value={stats.total} label="Posts" divider />
          </dl>
        </div>
      </section>

      {/* Double gold rule - a small broadsheet flourish */}
      <div className="h-[1px] bg-gold" />
      <div className="h-[3px] bg-gold mt-[2px]" />

      {/* ===========================================================
          01 - TOP STORIES (horizontal swipe carousel)
          =========================================================== */}
      {topStories.length > 0 && (
        <TopStoriesCarousel stories={topStories} />
      )}

      {/* ===========================================================
          02 - UPCOMING (horizontal scroll, newspaper-style date cards)
          =========================================================== */}
      <section id="upcoming" aria-labelledby="sec-upcoming">
        <SectionFolio
          num={2}
          title="Upcoming at Morgan"
          action={
            <a
              href="#events"
              className="inline-flex items-center gap-1 font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.14em] text-navy hover:text-gold no-underline min-h-[44px]"
            >
              Calendar <IconArrowRight />
            </a>
          }
        />
        <h2 id="sec-upcoming" className="sr-only">Upcoming at Morgan</h2>

        {events.length === 0 ? (
          <div className="px-5 py-4 text-[0.82rem] text-gray font-franklin">
            {loading ? 'Loading events...' : 'Nothing on the calendar yet.'}
          </div>
        ) : (
          <div
            className="flex gap-0 overflow-x-auto snap-x snap-mandatory pl-5 pr-5 pb-4 -mx-px"
            style={{ scrollbarWidth: 'none' }}
          >
            {events.slice(0, 12).map((ev, i) => {
              const { day, month } = eventDateParts(ev.event_date)
              const detail = [ev.location, ev.start_time].filter(Boolean).join(' · ')
              const isExternal = Boolean(ev.source_url)
              return (
                <a
                  key={ev.id}
                  href={safeHref(ev.source_url, '#events')}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noreferrer' : undefined}
                  className={`snap-start shrink-0 w-[250px] no-underline text-ink bg-card border border-ink/10 ${
                    i === 0 ? '' : 'border-l-0'
                  }`}
                >
                  <div className="bg-navy text-white px-4 pt-3 pb-3 flex items-baseline gap-2 border-b border-gold">
                    <span className="font-archivo font-black text-[1.7rem] leading-none tracking-[-0.02em]">
                      {day || '?'}
                    </span>
                    <span className="text-gold text-[0.62rem] uppercase tracking-[0.18em] font-archivo font-black">
                      {month}
                    </span>
                  </div>
                  <div className="px-4 py-3 min-h-[92px]">
                    <h3 className="font-archivo font-bold text-[0.88rem] leading-snug line-clamp-2">
                      {ev.title}
                    </h3>
                    {detail && (
                      <div className="text-gray text-[0.7rem] font-franklin mt-1 truncate">
                        {detail}
                      </div>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* ===========================================================
          03 - TRENDING (numbered ranking list)
          =========================================================== */}
      {restTrending.length > 0 && (
        <section aria-labelledby="sec-trending">
          <SectionFolio num={3} title="Trending" />
          <h2 id="sec-trending" className="sr-only">Trending posts</h2>

          <ol className="bg-card mx-px divide-y divide-ink/10">
            {restTrending.slice(0, 5).map((t, i) => (
              <li key={t.id}>
                <Link
                  to={`/post/${t.id}`}
                  className="flex items-start gap-3 px-5 py-4 min-h-[64px] no-underline text-ink"
                >
                  <span
                    className="font-archivo font-black text-gold leading-none tracking-[-0.06em] w-[34px] shrink-0 pt-1 select-none"
                    style={{ fontSize: '1.7rem' }}
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-archivo font-bold text-[0.92rem] leading-snug line-clamp-2">
                      {t.title}
                    </div>
                    <div className="flex items-center gap-2 text-[0.68rem] text-gray font-archivo font-bold tracking-wide mt-1.5">
                      <span className="flex items-center gap-1 text-warning">
                        <IconArrowUp />
                        {(t.upvotes ?? 0) - (t.downvotes ?? 0)}
                      </span>
                      <MetaDot />
                      <span>{t.comment_count ?? 0} comments</span>
                      {t.category && (
                        <>
                          <MetaDot />
                          <span className="uppercase tracking-[0.1em]">{t.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ===========================================================
          04 - MORE ON THE BOARD (compact post rows)
          =========================================================== */}
      <section id="more-on-the-board" aria-labelledby="sec-more">
        <SectionFolio
          num={4}
          title="More on the board"
          action={
            <a
              href="#feed"
              className="inline-flex items-center gap-1 font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.14em] text-gray hover:text-navy no-underline min-h-[44px]"
            >
              Filter <IconArrowRight />
            </a>
          }
        />
        <h2 id="sec-more" className="sr-only">More on the board</h2>

        {loading && moreOnBoard.length === 0 ? (
          <div className="px-5 py-6 text-[0.82rem] text-gray font-franklin">Loading posts...</div>
        ) : moreOnBoard.length === 0 ? (
          <div className="px-5 py-6 text-[0.82rem] text-gray font-franklin">
            No posts yet. Be the first.
          </div>
        ) : (
          <div className="bg-card">
            {moreOnBoard.map((post) => (
              <MobilePostCard
                key={post.id}
                post={post}
                onUpdated={onPostUpdated}
                onDeleted={onPostDeleted}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===========================================================
          05 - YOUR GROUPS
          =========================================================== */}
      <section id="groups" aria-labelledby="sec-groups">
        <SectionFolio
          num={5}
          title="Your groups"
          action={
            <button
              type="button"
              onClick={() => onCreateGroup?.()}
              className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.14em] text-navy hover:text-gold bg-transparent border-0 cursor-pointer min-h-[40px] px-2"
            >
              + New
            </button>
          }
        />
        <h2 id="sec-groups" className="sr-only">Your groups</h2>

        {groups.length === 0 ? (
          <div className="px-5 py-5 bg-card mx-px border-t border-ink/10">
            <p className="text-[0.88rem] text-gray font-franklin mb-3">
              No study groups yet. Start one for your course and invite classmates.
            </p>
            <button
              type="button"
              onClick={() => onCreateGroup?.()}
              className="w-full bg-navy text-white font-archivo font-extrabold text-[0.72rem] uppercase tracking-[0.1em] py-3 min-h-[44px] border-none cursor-pointer hover:bg-[#132d4a] transition-colors"
            >
              + Create a group
            </button>
          </div>
        ) : (
          <ul className="bg-card divide-y divide-ink/10 mx-px">
            {groups.slice(0, 8).map((g) => {
              const joined = myGroupIds?.has?.(g.id)
              return (
                <li key={g.id} className="flex items-center gap-3 px-5 py-3.5 min-h-[72px]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {g.course_code && (
                        <span className="font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.12em] text-navy bg-gold-pale px-2 py-[3px]">
                          {g.course_code}
                        </span>
                      )}
                      <span className="font-archivo font-bold text-[0.6rem] uppercase tracking-[0.14em] text-gray">
                        {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    <div className="font-archivo font-bold text-[0.95rem] leading-snug truncate">{g.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleMembership?.(g.id, joined)}
                    className={`font-archivo font-extrabold text-[0.64rem] uppercase tracking-[0.12em] py-2 px-3 min-h-[40px] shrink-0 border cursor-pointer transition-colors ${
                      joined
                        ? 'bg-transparent border-lightgray text-gray'
                        : 'bg-gold border-gold text-navy'
                    }`}
                  >
                    {joined ? 'Leave' : 'Join'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ===========================================================
          06 - CAMPUS SAFETY
          =========================================================== */}
      <section aria-labelledby="sec-safety">
        <SectionFolio num={6} title="Campus safety" />
        <h2 id="sec-safety" className="sr-only">Campus safety</h2>
        <div className="px-5">
          <SafetyBox />
        </div>
      </section>

      {/* Colophon - broadsheet footer */}
      <footer className="mt-8 mb-6 px-5">
        <div className="border-t-[3px] border-gold pt-3 flex items-center justify-between">
          <span className="font-archivo font-black text-[0.62rem] uppercase tracking-[0.2em] text-ink">
            BEARBOARD
          </span>
          <span className="font-archivo font-bold text-[0.56rem] uppercase tracking-[0.2em] text-gray">
            Morgan State · Spring {masthead.year}
          </span>
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top Stories carousel - horizontal swipe of up to five lead cards. Scroll
// snaps so each story lands centered. Dots below track position and are
// clickable to jump to a specific story. The folio header shows 1 / 5 so the
// reader always knows where they are in the run.
// ---------------------------------------------------------------------------

function TopStoriesCarousel({ stories }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const scrollerRef = useRef(null)

  // Reset to the first story whenever the list changes (fresh data load).
  useEffect(() => {
    setActiveIdx(0)
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0
  }, [stories.length])

  const onScroll = useCallback((e) => {
    const el = e.currentTarget
    const w = el.clientWidth || 1
    const idx = Math.min(stories.length - 1, Math.max(0, Math.round(el.scrollLeft / w)))
    if (idx !== activeIdx) setActiveIdx(idx)
  }, [activeIdx, stories.length])

  const jumpTo = (idx) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <article className="relative">
      <header className="flex items-baseline gap-3 px-5 pt-8 pb-3">
        <span
          className="font-archivo font-black text-gold leading-none tracking-[-0.04em] select-none"
          style={{ fontSize: '2.15rem' }}
          aria-hidden
        >
          01
        </span>
        <h2 className="font-archivo font-black text-[0.82rem] uppercase tracking-[0.18em] text-ink leading-none pb-1">
          Top stories
        </h2>
        <div className="flex-1 h-[1px] bg-ink/10 self-center mb-1" />
        <span className="pb-1 font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.14em] text-gray tabular-nums">
          {activeIdx + 1} / {stories.length}
        </span>
      </header>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
        aria-roledescription="carousel"
        aria-label="Top stories"
      >
        {stories.map((story, i) => (
          <TopStoryCard
            key={story.id}
            story={story}
            index={i}
            total={stories.length}
          />
        ))}
      </div>

      {/* Dot indicators - expandable pill on the active one. Tapping a
          dot jumps to that story so swipe isn't the only navigation. */}
      <div className="flex items-center justify-center gap-2 py-3" role="tablist" aria-label="Top stories navigation">
        {stories.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => jumpTo(i)}
            aria-label={`Go to story ${i + 1}`}
            aria-selected={i === activeIdx}
            role="tab"
            className={`h-1.5 rounded-full transition-all cursor-pointer border-0 p-0 ${
              i === activeIdx ? 'w-8 bg-gold' : 'w-1.5 bg-ink/25 hover:bg-ink/40'
            }`}
          />
        ))}
        <div className="w-3" />
        <a
          href="#more-on-the-board"
          className="font-archivo font-extrabold text-[0.6rem] uppercase tracking-[0.14em] text-gray hover:text-navy no-underline"
        >
          See all
        </a>
      </div>
    </article>
  )
}

function TopStoryCard({ story, index, total }) {
  return (
    <div className="snap-start shrink-0 basis-full min-w-0 px-0" style={{ width: '100%' }}>
      <Link
        to={`/post/${story.id}`}
        className="relative block no-underline text-white bg-navy overflow-hidden mx-px"
      >
        {/* Image backdrop */}
        {story.image_url && (
          <div className="absolute inset-0" aria-hidden>
            <img
              src={story.image_url}
              alt=""
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="w-full h-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/15" />
          </div>
        )}
        {/* Diagonal rule pattern */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 9px)',
          }}
          aria-hidden
        />

        <div className="relative px-5 pt-5 pb-5 min-h-[380px] flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-archivo font-black text-[0.56rem] uppercase tracking-[0.2em] px-2 py-1 bg-gold text-navy">
              {index === 0 ? 'Top story' : `No. ${index + 1}`}
            </span>
            {story.category && <CategoryPill category={story.category} inverse />}
          </div>

          <h3
            className="font-archivo font-black uppercase tracking-[-0.02em] leading-[0.98] mt-4"
            style={{ fontSize: 'clamp(1.75rem, 7vw, 2.2rem)' }}
          >
            {story.title}
          </h3>

          {story.body && (
            <p className="text-white/75 font-franklin text-[0.9rem] leading-snug mt-3 line-clamp-2 max-w-[34ch]">
              {story.body}
            </p>
          )}

          <div className="mt-auto pt-5 flex items-end justify-between gap-3 border-t border-white/20">
            <div className="flex items-center gap-2.5 min-w-0 pt-3">
              <Avatar seed={story.author?.id ?? story.id} name={story.author?.name} avatarUrl={story.author?.avatar_url} size={32} />
              <div className="min-w-0">
                <div className="font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.18em] text-white/55 leading-none">
                  By
                </div>
                <div className="font-archivo font-bold text-[0.82rem] truncate leading-tight mt-1">
                  {story.author?.name || 'Unknown'}
                </div>
                <div className="text-white/50 text-[0.66rem] font-franklin mt-0.5">
                  {formatRelative(story.created_at)} ago
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-3">
              <span className="flex items-center gap-1 text-gold font-archivo font-black text-[0.82rem]">
                <IconArrowUp />
                {story.upvote_count ?? story.upvotes ?? 0}
              </span>
              <span className="flex items-center gap-1 text-white/75 font-archivo font-extrabold text-[0.78rem]">
                <IconChatSm />
                {story.comment_count ?? 0}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

// Stat ledger cell - numeral in gold, label in small caps underneath.
// The divider prop adds a thin vertical rule on the left so three cells
// feel bound together instead of floating.
function StatCell({ value, label, divider = false }) {
  return (
    <div className={`${divider ? 'border-l border-white/15 pl-4' : ''}`}>
      <dt className="sr-only">{label}</dt>
      <dd className="font-archivo font-black text-gold text-[1.55rem] leading-none tracking-[-0.02em]">
        {value}
      </dd>
      <div className="font-archivo font-extrabold text-white/55 text-[0.56rem] uppercase tracking-[0.18em] mt-1.5">
        {label}
      </div>
    </div>
  )
}

export default MobileHome
