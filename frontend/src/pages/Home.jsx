import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ChatWidget from '../components/ChatWidget'
import MobileHome from '../components/MobileHome'
import { IconCaretUp, IconCaretDown, IconChat, IconBookmark, IconShare, IconCheck, IconFire, IconCalendar, IconSiren, IconClock, IconPin, IconUser } from '../components/ActionIcons'
import NewPostModal from '../components/NewPostModal'
import CreateGroupModal from '../components/CreateGroupModal'
import { FeedSkeleton, SidebarSkeleton } from '../components/Skeletons'
import EmptyState from '../components/EmptyState'
import SafetyBox from '../components/SafetyBox'
import NavRail from '../components/NavRail'
import RoleBadge from '../components/RoleBadge'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { flairSlug, flairLabel } from '../utils/avatar'

// Roles allowed to see internal messaging like the "Got a new idea?" banner.
// General students should not see team/Trello chrome.
const STAFF_ROLES = new Set(['developer', 'moderator', 'admin'])

const FEED_FILTERS = ['All', 'General', 'Academic', 'Events', 'Housing', 'Swap', 'Safety', 'Anonymous', 'Memes', 'Advice', 'Lost & Found', 'Admissions']

const AVATAR_PALETTE = [
  { bg: 'linear-gradient(135deg, #6B4AA0 0%, #3F2270 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #19314F 0%, #0B1D34 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #2BA89A 0%, #137267 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #D45347 0%, #962E22 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #EAA841 0%, #B47A14 100%)', tc: '#0B1D34' },
  { bg: 'linear-gradient(135deg, #4A8A4D 0%, #234C25 100%)', tc: '#FFFFFF' },
]

const ANON_AVATAR = { bg: 'linear-gradient(135deg, #2A2A2A 0%, #0B0B0B 100%)', tc: '#FFFFFF' }

function paletteFor(seed) {
  if (seed === -1) return ANON_AVATAR
  return AVATAR_PALETTE[Math.abs(seed ?? 0) % AVATAR_PALETTE.length]
}

function initialsFor(name) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function formatRelativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function formatEventDateTime(dateStr, timeStr) {
  if (!dateStr) return ''
  const [y, mo, d] = dateStr.split('-').map(Number)
  let hour = null
  let minute = 0
  if (timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number)
    hour = hh
    minute = mm || 0
  }
  const dt = new Date(y, (mo || 1) - 1, d || 1, hour ?? 0, minute)
  if (Number.isNaN(dt.getTime())) return ''
  const dateLabel = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  if (hour === null) return dateLabel
  const timeLabel = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateLabel} at ${timeLabel}`
}

const TEAM_DATA = {
  kyndal: { name: 'Kyndal Maclin', role: 'Product Owner', initials: 'KM', color: '#5B3A8C', tc: '#fff' },
  olu: { name: 'Oluwajomiloju King', role: 'Scrum Master', initials: 'OK', color: '#0B1D34', tc: '#fff' },
  aayush: { name: 'Aayush Shrestha', role: 'API, AI Agent & Backend', initials: 'AS', color: '#1A8A7D', tc: '#fff' },
  rohan: { name: 'Rohan Sainju', role: 'UI/UX', initials: 'RS', color: '#2E7D32', tc: '#fff' },
  sameer: { name: 'Sameer Shiwakoti', role: 'Frontend', initials: 'SS', color: '#C0392B', tc: '#fff' },
  johnson: { name: 'Johnson KC', role: 'Full Stack', initials: 'JK', color: '#D4962A', tc: '#0B1D34' },
}

const SAMPLE_POSTS = [
  {
    id: 1, initials: 'KM', color: '#5B3A8C', name: 'Kyndal Maclin', dept: 'Computer Science', time: '2h ago',
    category: 'events', title: 'Spring Career Fair - April 22nd at the Student Center',
    body: 'Google, Amazon, and Lockheed Martin confirmed. Bring resumes and dress business casual. Doors open at 10 AM. Last year was packed so get there early if you want face time with recruiters.',
    votes: 47, comments: 12,
  },
  {
    id: 2, initials: 'AS', color: '#0B1D34', name: 'Aayush Shrestha', dept: 'Computer Science', time: '4h ago',
    category: 'academic', title: 'COSC 350 Midterm Study Group - Need 2 More People',
    body: "We meet Tuesdays and Thursdays at the library 3rd floor. Currently going over networking layers and socket programming. If you're struggling with subnetting, we've got you covered.",
    votes: 31, comments: 8,
  },
  {
    id: 3, initials: 'RS', color: '#1A8A7D', name: 'Rohan Sainju', dept: 'Computer Science', time: '6h ago',
    category: 'recruiters', title: 'JPMorgan Software Engineering Internship - Summer 2026 Still Open',
    body: "Just got off a call with the campus recruiter. Applications close April 25th. They're specifically looking for Morgan State students this cycle. Link in comments.",
    votes: 64, comments: 23,
  },
  {
    id: 4, initials: 'SS', color: '#C0392B', name: 'Sameer Shiwakoti', dept: 'Information Systems', time: '8h ago',
    category: 'social', title: "Who's going to Yard Fest this weekend?",
    body: "Heard the lineup is crazy this year. Trying to see who else is going from the CS department so we can link up. Drop a comment if you're pulling up.",
    votes: 89, comments: 34,
  },
  {
    id: 5, initials: 'JK', color: '#D4962A', tc: '#0B1D34', name: 'Johnson KC', dept: 'Computer Science', time: '1d ago',
    category: 'general', title: 'Best quiet spots to code on campus?',
    body: "I need somewhere with good WiFi and outlets where I can work for a few hours without getting distracted. The library gets too packed after 2 PM. Any hidden gems?",
    votes: 22, comments: 15,
  },
]

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function eventDateParts(iso) {
  if (!iso) return { month: '', day: '', weekday: '' }
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return { month: '', day: '', weekday: '' }
  const dt = new Date(y, m - 1, d)
  return {
    month: MONTH_ABBR[m - 1] || '',
    day: String(d),
    weekday: Number.isNaN(dt.getTime()) ? '' : WEEKDAY_ABBR[dt.getDay()],
  }
}

const COURSE_PILL_PALETTE = [
  'bg-[#D1E3F5] text-navy',
  'bg-[#E6D8F0] text-purple',
  'bg-[#D0EDE9] text-[#0F5E54]',
  'bg-gold-pale text-[#8B6914]',
  'bg-[#F5D5D0] text-[#8B1A1A]',
]

function pillForCourse(code) {
  if (!code) return COURSE_PILL_PALETTE[0]
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0
  return COURSE_PILL_PALETTE[Math.abs(h) % COURSE_PILL_PALETTE.length]
}

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
  memes: 'bg-[#F0E4FC] text-[#5B3A8C]',
  advice: 'bg-[#D8E8F7] text-[#0F3F73]',
  lostfound: 'bg-[#F5E6C4] text-[#6B4A0D]',
  admissions: 'bg-[#D6EDD9] text-[#1E4B22]',
}

function Home() {
  const [activeSort, setActiveSort] = useState('new')
  const [activeFilter, setActiveFilter] = useState('All')
  const { user: authedUser } = useAuth()
  const navigate = useNavigate()
  const isStaff = Boolean(authedUser?.role && STAFF_ROLES.has(authedUser.role))
  const [showIdea, setShowIdea] = useState(true)
  const [showNewPost, setShowNewPost] = useState(false)
  const [postPreset, setPostPreset] = useState(null)
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [trending, setTrending] = useState([])
  const [events, setEvents] = useState([])
  const [groups, setGroups] = useState([])
  const [sidebarLoading, setSidebarLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [groupSearchActive, setGroupSearchActive] = useState(false)
  // Set of group ids the current user has joined. Loaded on mount (if
  // authed) and mutated optimistically on join/leave so the buttons
  // flip instantly without waiting on the round trip.
  const [myGroupIds, setMyGroupIds] = useState(() => new Set())
  const [groupBusy, setGroupBusy] = useState(null) // id currently joining/leaving
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const searchQuery = (searchParams.get('q') || '').trim().toLowerCase()

  // BottomNav's + tab navigates here with ?new=1. Open the modal and strip the
  // param so a refresh doesn't re-open it.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setPostPreset(null)
      setShowNewPost(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // BottomNav's + tab also dispatches a bearboard:newpost event as a more
  // reliable alternative to the ?new=1 ping-pong - needed because React
  // Router can no-op when navigating to the same pathname+search.
  useEffect(() => {
    const onNewPost = () => { setPostPreset(null); setShowNewPost(true) }
    window.addEventListener('bearboard:newpost', onNewPost)
    return () => window.removeEventListener('bearboard:newpost', onNewPost)
  }, [])

  const visiblePosts = useMemo(() => {
    if (!searchQuery) return posts
    return posts.filter((p) => {
      const hay = `${p.title || ''} ${p.body || ''}`.toLowerCase()
      return hay.includes(searchQuery)
    })
  }, [posts, searchQuery])

  // Megathreads float to the top of the feed. Recognized by a "Megathread:"
  // title prefix (set by seed_megathreads.py). When a future schema change
  // adds a real `is_pinned` column, swap the predicate here.
  const { pinnedPosts, regularPosts } = useMemo(() => {
    const pinned = []
    const regular = []
    for (const p of visiblePosts) {
      if (typeof p.title === 'string' && p.title.trim().toLowerCase().startsWith('megathread:')) {
        pinned.push(p)
      } else {
        regular.push(p)
      }
    }
    return { pinnedPosts: pinned, regularPosts: regular }
  }, [visiblePosts])

  useEffect(() => {
    let cancelled = false
    setSidebarLoading(true)
    Promise.all([
      apiFetch('/api/trending').catch(() => []),
      apiFetch('/api/events?limit=24').catch(() => []),
      apiFetch('/api/groups').catch(() => []),
    ]).then(([t, e, g]) => {
      if (cancelled) return
      setTrending(t || [])
      setEvents(e || [])
      setGroups(g || [])
    }).finally(() => { if (!cancelled) setSidebarLoading(false) })
    // Live hero metrics. Fails silently - hero falls back to "-" placeholders.
    apiFetch('/api/stats')
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [reloadKey])

  // Load which groups the current user belongs to so rows can render
  // Join vs Leave. Only authed users have memberships; logged-out
  // visitors always see a Join button that redirects to login.
  useEffect(() => {
    if (!authedUser) {
      setMyGroupIds(new Set())
      return
    }
    apiFetch('/api/groups/mine')
      .then((ids) => setMyGroupIds(new Set(ids || [])))
      .catch(() => setMyGroupIds(new Set()))
  }, [authedUser?.id])

  const toggleGroupMembership = async (groupId, joined) => {
    if (!authedUser) return
    setGroupBusy(groupId)
    // Optimistic update
    setMyGroupIds((prev) => {
      const next = new Set(prev)
      if (joined) next.delete(groupId); else next.add(groupId)
      return next
    })
    setGroups((prev) => prev.map((g) => (
      g.id === groupId ? { ...g, member_count: (g.member_count || 0) + (joined ? -1 : 1) } : g
    )))
    try {
      if (joined) {
        await apiFetch(`/api/groups/${groupId}/leave`, { method: 'DELETE' })
      } else {
        await apiFetch(`/api/groups/${groupId}/join`, { method: 'POST' })
      }
    } catch {
      // Rollback on failure
      setMyGroupIds((prev) => {
        const next = new Set(prev)
        if (joined) next.add(groupId); else next.delete(groupId)
        return next
      })
      setGroups((prev) => prev.map((g) => (
        g.id === groupId ? { ...g, member_count: (g.member_count || 0) + (joined ? 1 : -1) } : g
      )))
    } finally {
      setGroupBusy(null)
    }
  }

  const createGroup = async ({ name, course_code, description }) => {
    const group = await apiFetch('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, course_code, description }),
    })
    setGroups((prev) => [{ ...group }, ...prev])
    setMyGroupIds((prev) => new Set(prev).add(group.id))
    setShowCreateGroup(false)
  }

  // Debounced group search. When the user types a course code, refetch
  // /api/groups with ?course= so the backend does the LIKE match (which
  // knows that "cosc350" should match "COSC 350" and so on).
  useEffect(() => {
    const q = groupSearch.trim()
    if (!q) {
      // Cleared - reload the default list and drop the search flag.
      if (groupSearchActive) {
        setGroupSearchActive(false)
        apiFetch('/api/groups').catch(() => []).then((g) => setGroups(g || []))
      }
      return
    }
    setGroupSearchActive(true)
    const handle = setTimeout(() => {
      apiFetch(`/api/groups?course=${encodeURIComponent(q)}`)
        .catch(() => [])
        .then((g) => setGroups(g || []))
    }, 250)
    return () => clearTimeout(handle)
  }, [groupSearch])  // eslint-disable-line react-hooks/exhaustive-deps

  const sortParam = activeSort === 'new' ? 'newest' : activeSort
  // Normalize via flairSlug so labels like "Lost & Found" survive the round-trip
  // to the backend, which only knows the alphanumeric slug "lostfound".
  const categoryParam = activeFilter === 'All' ? null : flairSlug(activeFilter)

  useEffect(() => {
    let cancelled = false
    setPostsLoading(true)
    setPostsError(null)
    const params = new URLSearchParams({ sort: sortParam, limit: '50' })
    if (categoryParam) params.set('category', categoryParam)
    apiFetch(`/api/posts?${params.toString()}`)
      .then((data) => { if (!cancelled) setPosts(data) })
      .catch((err) => { if (!cancelled) setPostsError(err.message || 'Failed to load posts') })
      .finally(() => { if (!cancelled) setPostsLoading(false) })
    return () => { cancelled = true }
  }, [reloadKey, sortParam, categoryParam])

  return (
    <div>
      {/* Mobile + tablet dashboard (shown below lg). */}
      <MobileHome
        posts={visiblePosts}
        trending={trending}
        events={events}
        groups={groups}
        myGroupIds={myGroupIds}
        onToggleMembership={(id, joined) => (authedUser ? toggleGroupMembership(id, joined) : navigate('/login'))}
        onCreateGroup={() => (authedUser ? setShowCreateGroup(true) : navigate('/login'))}
        loading={postsLoading || sidebarLoading}
      />

      {/* Desktop layout (lg+) */}
      <div className="hidden lg:block">
      {/* Header - broadsheet masthead. Matches the mobile campus-broadsheet
          direction: gold flag line at top, date eyebrow, dynamic greeting
          if authed, a subtle diagonal stripe + corner glow for atmosphere,
          and a live stats ledger pulled from /api/stats. */}
      <div className="relative bg-navy overflow-hidden">
        {/* Gold diagonal hairline pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 14px)' }}
          aria-hidden
        />
        {/* Gold glow bottom-right */}
        <div
          className="absolute -bottom-36 -right-16 w-[520px] h-[520px] rounded-full bg-gold/[0.09] blur-3xl pointer-events-none"
          aria-hidden
        />

        <div className="relative max-w-[1080px] xl:max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-6 pt-5 pb-8 xl:pt-7 xl:pb-10">
          <HeroFlag stats={stats} />

          <div className="mt-5 xl:mt-7 flex justify-between items-end gap-10 flex-col md:flex-row md:items-end">
            <div className="max-w-[580px]">
              <HeroGreeting user={authedUser} />
              <p className="text-white/55 text-[0.92rem] xl:text-[0.98rem] mt-3 leading-relaxed max-w-[440px] font-franklin">
                Posts, study groups, events, and opportunities. All in one place, by students, for students.
              </p>
            </div>
            <dl className="flex gap-6 xl:gap-10 border-l border-white/10 pl-6 xl:pl-10">
              <HeroStat value={stats?.users} label="Students" />
              <HeroStat value={stats?.groups} label="Groups" />
              <HeroStat value={stats?.posts_last_24h} label="Today" highlight />
            </dl>
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      {/* Feed - Reddit-style 3-column layout at lg+:
             [ left NavRail | main feed | right rail ]
           Left rail is the navigation (Home/Popular/New/Trending +
           Events/Groups/Map/Profs/Team); right rail is content (Trending /
           Safety / Your Groups). Both are sticky. */}
      <div className="max-w-[1080px] xl:max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-6 pt-8 pb-7 grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_300px] xl:grid-cols-[220px_minmax(0,1fr)_320px] gap-5 xl:gap-7" id="feed">
        {/* Left rail - site navigation */}
        <aside className="lg:sticky lg:top-[68px] lg:self-start lg:max-h-[calc(100vh-68px)] lg:overflow-y-auto order-first">
          <NavRail />
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          {/* Upcoming Events Showcase */}
          <section className="mb-8" id="events-showcase">
            <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-archivo font-black text-[1.3rem] uppercase tracking-tight text-navy leading-none">
                  Upcoming at <span className="text-gold">Morgan</span>
                </h2>
                <p className="text-[0.75rem] text-gray mt-1.5">
                  Fresh from events.morgan.edu{sidebarLoading ? '' : events.length > 0 && ` · ${events.length} upcoming`}
                </p>
              </div>
              <a
                href="https://events.morgan.edu/"
                target="_blank"
                rel="noreferrer"
                className="font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide text-navy hover:text-gold transition-colors no-underline flex items-center gap-1"
              >
                View full calendar <span aria-hidden="true">&rarr;</span>
              </a>
            </div>

            {sidebarLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-card border border-lightgray overflow-hidden"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <div
                      className="aspect-[16/9] bg-gradient-to-br from-offwhite via-[#EBE7DE] to-offwhite bg-[length:200%_100%] animate-pulse"
                      style={{ animationDelay: `${i * 90}ms` }}
                    />
                    <div className="p-4 space-y-2">
                      <div className="h-[10px] bg-gold/20 rounded w-20 animate-pulse" style={{ animationDelay: `${i * 90 + 40}ms` }} />
                      <div className="h-4 bg-offwhite rounded animate-pulse w-3/4" style={{ animationDelay: `${i * 90 + 80}ms` }} />
                      <div className="h-3 bg-offwhite rounded animate-pulse w-1/2" style={{ animationDelay: `${i * 90 + 120}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="bg-card border border-lightgray px-4 py-8 text-center">
                <div className="text-[0.82rem] text-gray">No upcoming events synced yet.</div>
                <a
                  href="https://events.morgan.edu/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-wide text-navy hover:text-gold transition-colors no-underline border border-navy/20 hover:border-gold px-3 py-1.5"
                >
                  Open events.morgan.edu &rarr;
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {events.slice(0, 6).map((ev) => (
                  <EventShowcaseCard key={ev.id} ev={ev} />
                ))}
              </div>
            )}
          </section>

          <div className="flex items-center justify-between mb-4">
            <h2 className="font-archivo font-extrabold text-[0.85rem] uppercase tracking-widest text-gray">Campus Feed</h2>
            <div className="flex gap-1 bg-offwhite border border-lightgray rounded-full p-1">
              {['new', 'popular', 'trending'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSort(tab)}
                  className={`font-archivo text-[0.68rem] font-extrabold uppercase tracking-wide py-[5px] px-3 rounded-full cursor-pointer transition-all ${
                    activeSort === tab
                      ? 'bg-navy text-white shadow-[0_1px_3px_rgba(11,29,52,0.25)]'
                      : 'text-gray hover:text-ink'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-[18px]">
            {FEED_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-[0.7rem] font-semibold py-[5px] px-3 border rounded-full cursor-pointer uppercase tracking-wide transition-all ${
                  activeFilter === f
                    ? 'bg-navy border-navy text-white shadow-[0_1px_3px_rgba(11,29,52,0.2)]'
                    : 'bg-card border-lightgray text-gray hover:border-navy hover:text-navy hover:bg-offwhite'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Posts */}
          {postsLoading ? (
            <FeedSkeleton count={4} />
          ) : postsError ? (
            <div className="bg-card border border-lightgray px-[18px] py-6 text-center">
              <div className="text-[#8B1A1A] text-[0.85rem] font-archivo font-bold mb-2">{postsError}</div>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="bg-navy text-white border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#0a182b] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : visiblePosts.length === 0 ? (
            !searchQuery && activeFilter === 'All' ? (
              <WelcomeDemo onCreatePost={() => { setPostPreset(null); setShowNewPost(true) }} />
            ) : (
              <EmptyState
                icon={searchQuery ? '🔎' : '🔍'}
                title={
                  searchQuery
                    ? `No matches for "${searchQuery}"`
                    : `No ${activeFilter} posts yet`
                }
                body={
                  searchQuery
                    ? 'Try a different keyword, or clear the search in the nav.'
                    : `Switch the filter or be the first to post in ${activeFilter}.`
                }
                action={!searchQuery && (
                  <button
                    onClick={() => { setPostPreset(null); setShowNewPost(true) }}
                    className="bg-gold text-navy border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors"
                  >
                    + Create a post
                  </button>
                )}
              />
            )
          ) : (
            <>
              {pinnedPosts.length > 0 && (
                <div className="mb-3">
                  <div className="bg-navy text-gold px-4 py-2 font-archivo font-black text-[0.62rem] uppercase tracking-[0.22em] flex items-center gap-2">
                    <IconPin />
                    <span>Pinned megathreads</span>
                    <span className="ml-auto text-gold/60 font-franklin normal-case tracking-normal italic text-[0.72rem]">
                      Permanent discussion homes
                    </span>
                  </div>
                  <div className="border-l-[3px] border-l-gold">
                    {pinnedPosts.map((post) => (
                      <div key={post.id} className="border-b border-lightgray last:border-b-0 bg-gold/[0.04]">
                        <PostCard post={post} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <AnimatePresence initial={true}>
                {regularPosts.map((post, i) => (
                  <motion.div
                    key={post.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.32), ease: [0.22, 0.61, 0.36, 1] }}
                  >
                    <PostCard post={post} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Right rail - content widgets (Trending / Safety / Groups). */}
        <aside className="lg:sticky lg:top-[68px] lg:self-start lg:max-h-[calc(100vh-68px)] lg:overflow-y-auto lg:pr-1">
          {/* Trending */}
          <SideBox title="Trending" id="trending-box">
            {sidebarLoading ? (
              <SidebarSkeleton count={3} />
            ) : trending.length === 0 ? (
              <div className="px-4 py-3 text-[0.78rem] text-gray">No trending posts yet.</div>
            ) : trending.map((t, i) => (
              <Link
                key={t.id}
                to={`/post/${t.id}`}
                className="flex gap-3 items-start px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 no-underline text-ink hover:bg-offwhite transition-colors group/trend"
              >
                <div className="font-archivo font-black text-[1.6rem] text-gold leading-none w-[26px] tracking-tighter shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.82rem] font-semibold leading-tight mb-1 group-hover/trend:text-navy transition-colors line-clamp-2">{t.title}</div>
                  <div className="text-[0.68rem] text-gray flex items-center gap-2">
                    <span className="flex items-center gap-[3px]"><span className="text-gold">&#9650;</span>{(t.upvotes ?? 0) - (t.downvotes ?? 0)}</span>
                    <span className="opacity-40">&middot;</span>
                    <span>{t.comment_count ?? 0} comments</span>
                  </div>
                </div>
              </Link>
            ))}
          </SideBox>

          <SafetyBox onReportIncident={() => {
            setPostPreset({ category: 'Safety', body: '' })
            setShowNewPost(true)
          }} />

          {/* Groups */}
          <SideBox title="Your Groups" id="groups">
            <div className="px-3 py-2 border-b border-[#EAE7E0] bg-offwhite space-y-2">
              <input
                type="text"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search by course (e.g. COSC 350)"
                className="w-full bg-white border border-lightgray px-2.5 py-[6px] text-[0.78rem] font-franklin focus:border-navy placeholder:text-gray/60"
                aria-label="Search study groups by course"
              />
              <button
                type="button"
                onClick={() => authedUser ? setShowCreateGroup(true) : navigate('/login')}
                className="w-full bg-navy text-white font-archivo font-extrabold text-[0.7rem] uppercase tracking-wide py-2 border-none cursor-pointer hover:bg-[#132d4a] transition-colors"
              >
                + Create group
              </button>
            </div>
            {(sidebarLoading && !groupSearchActive) ? (
              <SidebarSkeleton count={3} />
            ) : groups.length === 0 ? (
              <div className="px-4 py-3 text-[0.78rem] text-gray">
                {groupSearch.trim()
                  ? `No groups match "${groupSearch.trim()}".`
                  : 'No groups yet. Create one above.'}
              </div>
            ) : groups.map((g) => {
              const joined = myGroupIds.has(g.id)
              const busy = groupBusy === g.id
              return (
                <div key={g.id} className="flex items-center gap-2 px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 hover:bg-offwhite transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {g.course_code && (
                      <span className={`font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-[7px] rounded-sm shrink-0 ${pillForCourse(g.course_code)}`}>
                        {g.course_code}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-[0.82rem] font-semibold truncate leading-tight">{g.name}</div>
                      <div className="text-[0.62rem] text-gray font-archivo font-bold flex items-center gap-1 mt-0.5">
                        <IconUser />{g.member_count}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => authedUser ? toggleGroupMembership(g.id, joined) : navigate('/login')}
                    disabled={busy}
                    className={`font-archivo font-extrabold text-[0.62rem] uppercase tracking-wider py-1.5 px-2.5 shrink-0 border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait ${
                      joined
                        ? 'bg-transparent border-lightgray text-gray hover:border-danger hover:text-danger'
                        : 'bg-gold border-gold text-navy hover:bg-[#E5A92E]'
                    }`}
                  >
                    {busy ? '...' : joined ? 'Leave' : 'Join'}
                  </button>
                </div>
              )
            })}
          </SideBox>
        </aside>
      </div>

      {/* Idea Banner - staff-only (developer, moderator, admin). General
           students never see the Trello / sprint-backlog chrome. */}
      {isStaff && showIdea && (
        <div className="max-w-[1080px] xl:max-w-[1200px] 2xl:max-w-[1320px] mx-auto px-6">
          <div className="bg-navy px-5 py-4 flex items-center gap-3.5">
            <div className="text-[1.3rem]">&#128161;</div>
            <div className="flex-1 text-white/70 text-[0.85rem]">
              <b className="text-gold">Got a new idea?</b> Add it to the Trello board and sprint backlog so the team can review it.
            </div>
            <a
              href="https://trello.com/b/ZVVEpSeC/my-trello-board"
              target="_blank"
              rel="noreferrer"
              className="font-archivo font-extrabold text-[0.72rem] uppercase tracking-wide bg-gold text-navy px-[18px] py-[9px] no-underline hover:bg-[#E5A92E] transition-colors shrink-0 rounded-full"
            >
              + Add Idea
            </a>
            <button
              onClick={() => setShowIdea(false)}
              className="bg-transparent border-none text-white/30 text-[1.1rem] cursor-pointer hover:text-white/70"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Team Section */}
      <div className="max-w-[1080px] xl:max-w-[1200px] 2xl:max-w-[1320px] mx-auto px-6 pt-8" id="team">
        <h2 className="font-archivo font-black text-[0.85rem] uppercase tracking-widest text-navy">The Team</h2>
        <p className="text-[0.78rem] text-gray mt-1">COSC 458 &middot; Software Engineering &middot; Spring 2026</p>
      </div>
      <div className="max-w-[1080px] xl:max-w-[1200px] 2xl:max-w-[1320px] mx-auto px-6 pb-8 pt-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(TEAM_DATA).map(([key, m]) => (
          <div
            key={key}
            className="bg-card border border-lightgray p-4 text-center"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-archivo font-extrabold text-[0.72rem] mx-auto mb-2"
              style={{ background: m.color, color: m.tc }}
            >
              {m.initials}
            </div>
            <div className="font-archivo font-bold text-[0.78rem]">{m.name}</div>
            <div className="text-[0.65rem] text-gray mt-[2px]">{m.role}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="bg-navy py-5 text-center text-white/30 text-[0.72rem]">
        BearBoard &copy; 2026 &middot; COSC 458 Software Engineering &middot; Morgan State University &middot;{' '}
        <a href="https://trello.com/b/ZVVEpSeC/my-trello-board" target="_blank" rel="noreferrer" className="text-gold no-underline">
          Trello
        </a>
      </footer>
      </div> {/* /desktop layout (lg+) */}

      {/* New Post FAB - desktop only; mobile uses the + tab in BottomNav. */}
      <button
        onClick={() => { setPostPreset(null); setShowNewPost(true) }}
        className="hidden lg:flex fixed bottom-[84px] right-6 bg-gold text-navy border-none py-3 px-5 font-archivo text-[0.75rem] font-extrabold uppercase tracking-wide cursor-pointer z-50 items-center gap-1.5 hover:bg-[#E5A92E] transition-colors"
      >
        + New Post
      </button>

      <NewPostModal
        open={showNewPost}
        preset={postPreset}
        onClose={() => { setShowNewPost(false); setPostPreset(null) }}
        onCreated={() => setReloadKey((k) => k + 1)}
      />

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreate={createGroup}
      />

      {/* Chat Widget - desktop only on small screens it would collide with BottomNav. */}
      <div className="hidden lg:block">
        <ChatWidget />
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Hero primitives - broadsheet-style masthead pieces for the desktop header.
// -----------------------------------------------------------------------------

const WEEKDAY_SHORT_CAPS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_LONG_CAPS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

function HeroFlag({ stats }) {
  // Top "newspaper flag" - issue number + date + synced-events badge.
  // Mirrors the MobileHome masthead so brand language is consistent.
  const now = new Date()
  const issue = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24)) + 1
  const weekday = WEEKDAY_SHORT_CAPS[now.getDay()]
  const month = MONTH_LONG_CAPS[now.getMonth()]
  const year = now.getFullYear()
  return (
    <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/15">
      <div className="flex items-center gap-3 font-archivo font-extrabold text-[0.6rem] uppercase tracking-[0.22em]">
        <span className="text-gold">BearBoard</span>
        <span className="text-white/25" aria-hidden>|</span>
        <span className="text-white/55">
          {weekday} &middot; {month} {now.getDate()}, {year}
        </span>
      </div>
      <div className="flex items-center gap-4 font-archivo font-bold text-[0.6rem] uppercase tracking-[0.18em] text-white/45">
        <span>No. {issue}</span>
        {stats?.synced_campus_events != null && (
          <>
            <span className="text-white/20" aria-hidden>/</span>
            <span className="text-white/65">
              {stats.synced_campus_events} events synced
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function HeroGreeting({ user }) {
  // Dynamic headline. Logged-in students get a time-of-day greeting; anyone
  // else sees the evergreen "What's happening at Morgan State" billboard.
  const first = (user?.name || '').split(/\s+/).filter(Boolean)[0]
  if (first) {
    const h = new Date().getHours()
    const greet = h < 5 ? 'UP LATE' : h < 12 ? 'GOOD MORNING' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'
    return (
      <>
        <div className="font-archivo font-extrabold text-gold text-[0.72rem] uppercase tracking-[0.22em] mb-2">
          Campus edition &middot; {greet}
        </div>
        <h1 className="font-archivo font-black text-white text-[2.25rem] xl:text-[2.95rem] leading-[1.02] tracking-[-0.01em] uppercase">
          Hey, <span className="text-gold">{first}</span>
          <span className="block">what's happening</span>
          <span className="block text-white/40 text-[1.35rem] xl:text-[1.65rem] font-extrabold tracking-tight normal-case mt-2">
            at Morgan State today?
          </span>
        </h1>
      </>
    )
  }
  return (
    <>
      <div className="font-archivo font-extrabold text-gold text-[0.72rem] uppercase tracking-[0.22em] mb-2">
        Campus edition &middot; Spring 2026
      </div>
      <h1 className="font-archivo font-black text-white text-[2.25rem] xl:text-[2.95rem] leading-[1.02] tracking-[-0.01em] uppercase">
        What's happening
        <span className="text-gold block">at Morgan State</span>
      </h1>
    </>
  )
}

function HeroStat({ value, label, highlight = false }) {
  const display =
    value == null ? '-' : value >= 1000 ? value.toLocaleString() : String(value)
  return (
    <div className="text-right">
      <dt className="sr-only">{label}</dt>
      <dd
        className={`font-archivo font-black leading-none tracking-[-0.02em] tabular-nums ${
          highlight ? 'text-gold text-[2.2rem] xl:text-[2.6rem]' : 'text-white text-[1.7rem] xl:text-[2rem]'
        }`}
      >
        {display}
      </dd>
      <div
        className={`text-[0.6rem] xl:text-[0.66rem] uppercase tracking-[0.18em] font-archivo font-extrabold mt-1.5 ${
          highlight ? 'text-gold/80' : 'text-white/35'
        }`}
      >
        {label}
      </div>
    </div>
  )
}

function SideBox({ title, children, id }) {
  return (
    <div className="border border-lightgray bg-card mb-3.5 overflow-hidden rounded-xl shadow-sm" id={id}>
      <div className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest px-4 py-3 bg-navy text-gold">
        {title}
      </div>
      {children}
    </div>
  )
}

function PostCard({ post }) {
  const categoryKey = (post.category || 'general').toLowerCase()
  const catClass = CAT_STYLES[categoryKey] || CAT_STYLES.general
  const isAnonymous = categoryKey === 'anonymous'
  const isEvent = categoryKey === 'events' || categoryKey === 'event'

  const authorName = isAnonymous ? 'Anonymous' : (post.author?.name || 'Unknown')
  const authorMajor = isAnonymous ? '' : (post.author?.major || '')
  const avatar = paletteFor(isAnonymous ? -1 : post.author?.id ?? post.id)
  const initials = isAnonymous ? '?' : initialsFor(authorName)
  const eventLabel = isEvent ? formatEventDateTime(post.event_date, post.event_time) : ''

  const initialScore = (post.upvotes ?? 0) - (post.downvotes ?? 0)
  const [score, setScore] = useState(initialScore)
  const [userVote, setUserVote] = useState(null)
  const [pending, setPending] = useState(false)
  const [voteError, setVoteError] = useState(null)
  const [popKey, setPopKey] = useState(0)
  const { isAuthed } = useAuth()
  const nav = useNavigate()

  const applyVote = async (voteType) => {
    if (pending) return
    // Voting requires auth. Send unauthed users to /login instead of
    // firing a POST that'll come back 403 (FastAPI's HTTPBearer returns
    // 403 for a missing Authorization header, not 401) and showing a
    // vague "Vote failed" error on the card.
    if (!isAuthed) {
      nav('/login')
      return
    }

    const prevScore = score
    const prevVote = userVote

    let nextScore = score
    let nextVote = userVote
    if (userVote === voteType) {
      nextScore += voteType === 'up' ? -1 : 1
      nextVote = null
    } else if (userVote === null) {
      nextScore += voteType === 'up' ? 1 : -1
      nextVote = voteType
    } else {
      nextScore += voteType === 'up' ? 2 : -2
      nextVote = voteType
    }

    setScore(nextScore)
    setUserVote(nextVote)
    setPopKey((k) => k + 1)
    setPending(true)
    setVoteError(null)

    try {
      await apiFetch(`/api/posts/${post.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_type: voteType }),
      })
    } catch (err) {
      setScore(prevScore)
      setUserVote(prevVote)
      if (err.status === 401 || err.status === 403) {
        // Token expired/missing - bounce to login.
        nav('/login')
      } else {
        setVoteError('Vote failed. Try again.')
        setTimeout(() => setVoteError(null), 2000)
      }
    } finally {
      setPending(false)
    }
  }

  const upActive = userVote === 'up'
  const downActive = userVote === 'down'
  const isHot = score >= 20
  const [imgBroken, setImgBroken] = useState(false)
  const hasImage = Boolean(post.image_url) && !imgBroken

  // Save (localStorage-backed; no backend endpoint for this yet).
  const [saved, setSaved] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('bb:saved') || '[]')
      return Array.isArray(raw) && raw.includes(post.id)
    } catch { return false }
  })
  const toggleSave = () => {
    try {
      const set = new Set(JSON.parse(localStorage.getItem('bb:saved') || '[]'))
      if (saved) set.delete(post.id); else set.add(post.id)
      localStorage.setItem('bb:saved', JSON.stringify(Array.from(set)))
    } catch { /* storage unavailable - still flip local state */ }
    setSaved((v) => !v)
  }

  // Share via Web Share API when available, otherwise copy link. Briefly
  // show a confirmation on the button.
  const [shareState, setShareState] = useState(null) // null | 'copied' | 'failed'
  const doShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareState('copied')
    } catch (err) {
      if (err && err.name === 'AbortError') return
      setShareState('failed')
    }
    setTimeout(() => setShareState(null), 1800)
  }

  const vote = (dir) => {
    if (userVote === dir) {
      setVotes(votes + (dir === 'up' ? -1 : 1))
      setUserVote(null)
    } else {
      setVotes(votes + (dir === 'up' ? (userVote === 'down' ? 2 : 1) : (userVote === 'up' ? -2 : -1)))
      setUserVote(dir)
    }
  }

  return (
    <div className={`group bg-card border border-lightgray border-l-[3px] mb-3 overflow-hidden transition-all duration-150 hover:shadow-[0_6px_24px_-10px_rgba(11,29,52,0.22)] hover:-translate-y-[1px] ${
      post.is_sos && !post.sos_resolved ? 'border-l-[#8B1A1A] bg-[#FBF3F2]' : isEvent ? 'border-l-gold' : 'border-l-lightgray hover:border-l-gold'
    }`}>
      {/* Header + title */}
      <div className="px-[18px] pt-4 pb-2">
        {post.is_sos && (
          <div className={`mb-2.5 flex items-center gap-2 text-[0.65rem] font-archivo font-extrabold uppercase tracking-wider ${
            post.sos_resolved ? 'text-[#0F5E54]' : 'text-[#8B1A1A]'
          }`}>
            <span className={`px-2 py-[3px] rounded-sm flex items-center gap-1 ${
              post.sos_resolved ? 'bg-success-bg' : 'bg-danger text-white status-dot'
            }`}>
              <IconSiren />
              {post.sos_resolved ? 'SOS resolved' : 'SOS needs help'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-archivo font-black text-[0.65rem] shrink-0 ring-1 ring-black/5"
            style={{ background: avatar.bg, color: avatar.tc }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <strong className="text-[0.82rem] font-semibold leading-tight truncate">{authorName}</strong>
              {!isAnonymous && <RoleBadge role={post.author?.role} />}
              <span className="text-gray/60 text-[0.72rem]">&middot;</span>
              <span className="text-[0.72rem] text-gray font-archivo">{formatRelativeTime(post.created_at)}</span>
              {authorMajor && (
                <>
                  <span className="text-gray/60 text-[0.72rem] hidden sm:inline">&middot;</span>
                  <span className="text-[0.7rem] text-gray truncate hidden sm:inline">{authorMajor}</span>
                </>
              )}
            </div>
          </div>
          {isHot && (
            <span
              className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#D4962A] text-white flex items-center gap-1 shrink-0"
              title="High engagement"
            >
              <IconFire /> Hot
            </span>
          )}
          {isEvent && (
            <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full bg-gold text-navy flex items-center gap-1 shrink-0">
              <IconCalendar /> Event
            </span>
          )}
          <span className={`font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full shrink-0 ${catClass}`}>
            {flairLabel(post.category)}
          </span>
        </div>
        <Link to={`/post/${post.id}`} className="no-underline text-ink block group/title">
          <h3 className="font-archivo font-bold text-[1.15rem] leading-[1.25] mb-1 tracking-tight group-hover/title:text-navy transition-colors">
            {post.title}
          </h3>
        </Link>
      </div>

      {/* Edge-to-edge image */}
      {hasImage && (
        <Link to={`/post/${post.id}`} className="block bg-black/80 overflow-hidden">
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgBroken(true)}
            className="w-full max-h-[520px] object-contain mx-auto"
          />
        </Link>
      )}

      {/* Meta row (price / contact / event) */}
      <div className="px-[18px] pt-3">
        {(post.price || post.contact_info) && (
          <div className="flex flex-wrap items-center gap-2 mb-2 text-[0.76rem]">
            {post.price && (
              <span className="font-archivo font-extrabold text-navy bg-gold-pale border border-gold/40 px-2 py-[3px] rounded-sm">
                {post.price}
              </span>
            )}
            {post.contact_info && (
              <span className="text-gray">
                <span aria-hidden="true">&#9993;</span> {post.contact_info}
              </span>
            )}
          </div>
        )}
        {isEvent && eventLabel && (
          <div className="bg-warning-bg border-l-[3px] border-gold px-3 py-2 mb-2 font-archivo font-bold text-[0.8rem] text-warning flex items-center gap-2">
            <IconClock /> {eventLabel}
          </div>
        )}
        {post.body && (
          <div className="relative mb-3">
            <div className="text-[0.88rem] text-ink/80 leading-relaxed whitespace-pre-wrap line-clamp-3">
              {post.body}
            </div>
            {/* Gradient fade at the bottom hints that there's more content
                to read when the body overflows past 3 lines. Rough length
                check keeps the fade off short posts that fit in clamp. */}
            {post.body.length > 180 && (
              <div
                className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card via-card/85 to-transparent pointer-events-none"
                aria-hidden
              />
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-[18px] pb-3.5 pt-1">
        <div className="flex items-center gap-1.5 pt-2.5 border-t border-[#EAE7E0]">
          {/* Vote pill */}
          <div
            className={`flex items-center font-archivo rounded-full border transition-colors ${
              upActive
                ? 'bg-gold/15 border-gold/40'
                : downActive
                ? 'bg-[#8B1A1A]/10 border-[#8B1A1A]/25'
                : 'bg-offwhite border-transparent hover:border-lightgray'
            }`}
          >
            <button
              onClick={() => applyVote('up')}
              aria-label="Upvote"
              aria-pressed={upActive}
              disabled={pending}
              className={`flex items-center justify-center w-7 h-7 rounded-l-full bg-transparent border-none cursor-pointer transition-colors disabled:cursor-wait ${
                upActive ? 'text-gold' : 'text-gray hover:text-navy'
              }`}
            >
              <IconCaretUp filled={upActive} />
            </button>
            <span
              key={popKey}
              className={`font-extrabold text-[0.78rem] min-w-[22px] text-center vote-pop tabular-nums ${
                upActive ? 'text-gold' : downActive ? 'text-[#8B1A1A]' : 'text-ink'
              }`}
            >
              {score}
            </span>
            <button
              onClick={() => applyVote('down')}
              aria-label="Downvote"
              aria-pressed={downActive}
              disabled={pending}
              className={`flex items-center justify-center w-7 h-7 rounded-r-full bg-transparent border-none cursor-pointer transition-colors disabled:cursor-wait ${
                downActive ? 'text-[#8B1A1A]' : 'text-gray hover:text-navy'
              }`}
            >
              <IconCaretDown filled={downActive} />
            </button>
          </div>

          {/* Comments */}
          <Link
            to={`/post/${post.id}`}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-offwhite text-gray text-[0.74rem] font-archivo font-bold no-underline hover:text-navy hover:bg-[#EDE9DF] transition-colors"
            aria-label={`${post.comment_count ?? 0} comments`}
          >
            <IconChat />
            <span className="tabular-nums">{post.comment_count ?? 0}</span>
          </Link>

          {/* Save */}
          <button
            onClick={toggleSave}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved' : 'Save post'}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[0.74rem] font-archivo font-bold transition-colors border-none cursor-pointer ${
              saved
                ? 'bg-gold/15 text-[#8B6914] hover:bg-gold/25'
                : 'bg-offwhite text-gray hover:text-navy hover:bg-[#EDE9DF]'
            }`}
          >
            <IconBookmark filled={saved} />
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>

          {/* Share */}
          <button
            onClick={doShare}
            aria-label="Share post"
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[0.74rem] font-archivo font-bold transition-colors border-none cursor-pointer ${
              shareState === 'copied'
                ? 'bg-[#D0EDE9] text-[#0F5E54]'
                : shareState === 'failed'
                ? 'bg-[#F5D5D0] text-[#8B1A1A]'
                : 'bg-offwhite text-gray hover:text-navy hover:bg-[#EDE9DF]'
            }`}
          >
            {shareState === 'copied' ? <IconCheck /> : <IconShare />}
            <span>
              {shareState === 'copied' ? 'Copied' : shareState === 'failed' ? 'Failed' : 'Share'}
            </span>
          </button>

          {voteError && <span className="text-[0.7rem] text-[#8B1A1A] ml-auto font-archivo font-bold">{voteError}</span>}
        </div>
      </div>
    </div>
  )
}

const DEMO_FEATURES = [
  { icon: '✍️', title: 'Start a conversation', body: 'Ask a question, share a link, vent about finals. Feed lives here.' },
  { icon: '📚', title: 'Find study partners', body: 'Post a course code, find others in the same class, meet at the library.' },
  { icon: '📅', title: 'Never miss an event', body: 'Morgan State events auto-sync from events.morgan.edu with photos and locations.' },
  { icon: '🏠', title: 'Housing & Swap', body: 'Find a subletter, sell your old textbook, grab a free couch.' },
  { icon: '🎓', title: 'Rate a professor', body: 'Overall, difficulty, would-take-again. Help your classmates pick well.' },
  { icon: '🚨', title: 'Anonymous SOS', body: 'Pinned to the top, notifies your major. Help arrives fast, your name stays out.' },
]

const DEMO_TESTIMONIALS = [
  {
    id: 't1',
    quote: 'Found my study group for COSC 350 in one day. Midterm went from "panic" to "I got this."',
    name: 'Sameer S.',
    role: 'CS Sophomore',
    initials: 'SS',
    bg: 'linear-gradient(135deg, #D45347 0%, #962E22 100%)',
  },
  {
    id: 't2',
    quote: 'Sold my old laptop through Swap in under an hour. Way less sketchy than Facebook Marketplace.',
    name: 'Kyndal M.',
    role: 'Comm Senior',
    initials: 'KM',
    bg: 'linear-gradient(135deg, #6B4AA0 0%, #3F2270 100%)',
  },
  {
    id: 't3',
    quote: "Events page keeps me from missing free pizza. Also some actually useful career stuff.",
    name: 'Aayush S.',
    role: 'CS Junior',
    initials: 'AS',
    bg: 'linear-gradient(135deg, #2BA89A 0%, #137267 100%)',
  },
]

function WelcomeDemo({ onCreatePost }) {
  return (
    <div className="bg-card border border-lightgray overflow-hidden">
      {/* Hero strip */}
      <div className="bg-navy px-6 py-7 text-center relative">
        <div className="inline-flex items-center gap-1.5 bg-gold/20 text-gold font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3">
          <span aria-hidden="true">🐻</span> Welcome
        </div>
        <h2 className="font-archivo font-black text-[1.6rem] text-white uppercase tracking-tight leading-none">
          This is <span className="text-gold">BearBoard</span>
        </h2>
        <p className="text-white/60 text-[0.88rem] max-w-[440px] mx-auto mt-2.5 leading-relaxed">
          The feed is quiet right now. Here's what Morgan students actually use it for.
        </p>
      </div>

      {/* Feature grid */}
      <div className="px-5 py-6">
        <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.2em] text-gray text-center mb-4">
          What you can do here
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {DEMO_FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-offwhite border border-lightgray px-3.5 py-3 hover:border-navy hover:bg-card transition-colors"
            >
              <div className="text-[1.4rem] leading-none mb-2" aria-hidden="true">{f.icon}</div>
              <div className="font-archivo font-extrabold text-[0.82rem] text-navy leading-tight mb-1">
                {f.title}
              </div>
              <div className="text-[0.72rem] text-gray leading-snug">{f.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-offwhite border-t border-[#EAE7E0] px-5 py-6">
        <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.2em] text-gray text-center mb-4">
          What students are saying
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_TESTIMONIALS.map((t) => (
            <div key={t.id} className="bg-card border border-lightgray px-4 py-4 relative">
              <div className="text-gold font-archivo font-black text-[1.4rem] leading-none mb-1" aria-hidden="true">
                &ldquo;
              </div>
              <div className="text-[0.82rem] text-ink leading-relaxed mb-3">{t.quote}</div>
              <div className="flex items-center gap-2 pt-2 border-t border-[#EAE7E0]">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-archivo font-black text-[0.62rem] text-white shrink-0 ring-1 ring-black/5"
                  style={{ background: t.bg }}
                >
                  {t.initials}
                </div>
                <div className="min-w-0">
                  <div className="font-archivo font-extrabold text-[0.78rem] text-navy leading-tight truncate">{t.name}</div>
                  <div className="text-[0.65rem] text-gray uppercase tracking-wide font-archivo font-bold truncate">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 py-6 text-center border-t border-[#EAE7E0]">
        <div className="font-archivo font-extrabold text-[0.78rem] text-navy mb-2">
          Your turn.
        </div>
        <div className="text-[0.78rem] text-gray mb-4 max-w-[380px] mx-auto">
          Pick a category, share what's on your mind, hit post. The first post sets the tone.
        </div>
        <button
          onClick={onCreatePost}
          className="bg-gold text-navy border-none py-2.5 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors"
        >
          + Create the first post
        </button>
      </div>
    </div>
  )
}

function EventShowcaseCard({ ev }) {
  const { month, day, weekday } = eventDateParts(ev.event_date)
  const [imgBroken, setImgBroken] = useState(false)
  const hasImage = Boolean(ev.image_url) && !imgBroken
  const dateLabel = formatEventDateTime(ev.event_date, ev.start_time)
  const isExternal = Boolean(ev.source)

  const Wrapper = ev.source_url ? 'a' : 'div'
  const wrapperProps = ev.source_url
    ? { href: ev.source_url, target: '_blank', rel: 'noreferrer' }
    : {}

  return (
    <Wrapper
      {...wrapperProps}
      className="group bg-card border border-lightgray overflow-hidden block no-underline text-ink hover:shadow-[0_8px_28px_-12px_rgba(11,29,52,0.3)] hover:-translate-y-[2px] hover:border-gold transition-all duration-200"
    >
      {hasImage ? (
        <div className="aspect-[16/9] overflow-hidden bg-offwhite relative">
          <img
            src={ev.image_url}
            onError={() => setImgBroken(true)}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
            alt=""
          />
          <div className="absolute top-3 left-3 bg-white w-[46px] rounded-sm overflow-hidden shadow-[0_2px_8px_rgba(11,29,52,0.35)]">
            <div className="bg-navy text-gold text-[0.5rem] uppercase tracking-wider font-archivo font-extrabold text-center py-[2px]">
              {weekday || month}
            </div>
            <div className="text-center py-[3px] bg-white">
              <div className="font-archivo font-black text-navy text-[1.2rem] leading-none">{day}</div>
              <div className="text-[0.48rem] uppercase tracking-wider text-gray font-archivo font-bold mt-[1px]">
                {month}
              </div>
            </div>
          </div>
          {isExternal && (
            <span className="absolute top-3 right-3 font-archivo text-[0.55rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-navy/90 text-gold backdrop-blur">
              {ev.source}
            </span>
          )}
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-navy to-[#0a182b] relative flex items-center justify-center">
          <div className="text-center">
            <div className="font-archivo font-black text-gold text-[3rem] leading-none tracking-tight">{day}</div>
            <div className="text-gold/80 text-[0.65rem] uppercase tracking-widest font-archivo font-extrabold mt-1">
              {weekday} &middot; {month}
            </div>
          </div>
          {isExternal && (
            <span className="absolute top-3 right-3 font-archivo text-[0.55rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-white/15 text-gold">
              {ev.source}
            </span>
          )}
        </div>
      )}
      <div className="p-4">
        <h3 className="font-archivo font-bold text-[0.95rem] leading-snug mb-2 tracking-tight group-hover:text-navy transition-colors line-clamp-2 min-h-[2.5em]">
          {ev.title}
        </h3>
        {dateLabel && (
          <div className="text-[0.72rem] text-gray flex items-center gap-1.5 font-archivo font-bold">
            <IconClock />
            <span className="truncate">{dateLabel}</span>
          </div>
        )}
        {ev.location && (
          <div className="text-[0.72rem] text-gray flex items-center gap-1.5 mt-1">
            <IconPin />
            <span className="truncate">{ev.location}</span>
          </div>
        )}
      </div>
    </Wrapper>
  )
}

export default Home
