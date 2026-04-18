import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ChatWidget from '../components/ChatWidget'
import NewPostModal from '../components/NewPostModal'
import { FeedSkeleton, SidebarSkeleton } from '../components/Skeletons'
import EmptyState from '../components/EmptyState'
import { apiFetch } from '../api/client'

const FEED_FILTERS = ['All', 'General', 'Academic', 'Events', 'Anonymous']

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
  kyndal: { name: 'Kyndal Maclin', role: 'Product Owner', initials: 'KM', color: '#5B3A8C', tc: '#fff',
    tasks: [
      { id: 'PO-01', desc: 'Define and prioritize the product backlog for all 4 sprints', p: 'h' },
      { id: 'PO-02', desc: 'Accept or reject completed sprint deliverables', p: 'h' },
      { id: 'PO-03', desc: 'Communicate product vision and requirements to the team', p: 'm' },
      { id: 'PO-04', desc: 'Gather user feedback and validate feature decisions', p: 'm' },
    ],
  },
  olu: { name: 'Oluwajomiloju King', role: 'Scrum Master', initials: 'OK', color: '#0B1D34', tc: '#fff',
    tasks: [
      { id: 'S1-04', desc: 'Set up Git repo, branch strategy, CI linting, and README', p: 'h' },
      { id: 'S1-14', desc: 'Set up Trello board with Sprint 1 cards, coordinate standups, track blockers', p: 'h' },
      { id: 'S1-15', desc: 'Write Sprint 1 review/retrospective document and demo prep', p: 'l' },
    ],
  },
  aayush: { name: 'Aayush Shrestha', role: 'API, AI Agent & Backend', initials: 'AS', color: '#1A8A7D', tc: '#fff',
    tasks: [
      { id: 'S1-01', desc: 'Initialize FastAPI backend: project structure, Pydantic schemas, CORS, Swagger docs', p: 'h' },
      { id: 'S1-08', desc: 'Build CRUD API endpoints for posts (create, list, get single, delete)', p: 'm' },
      { id: 'S1-09', desc: 'Implement upvote/downvote API (one vote per user per post)', p: 'm' },
      { id: 'S1-16', desc: 'Set up AI agent scaffolding: LLM client, agents/ folder, content moderation placeholder', p: 'l' },
    ],
  },
  rohan: { name: 'Rohan Sainju', role: 'UI/UX', initials: 'RS', color: '#2E7D32', tc: '#fff',
    tasks: [
      { id: 'S1-12', desc: 'Design BearBoard design system: color palette, Tailwind theme, fonts, reusable UI components', p: 'h' },
      { id: 'S1-17', desc: 'Design event calendar view UI and create post modal with category selection', p: 'm' },
      { id: 'S1-18', desc: 'Design and build post detail page with comments section', p: 'm' },
      { id: 'S1-19', desc: 'UX polish: responsive testing, hover states, transitions, user flow review', p: 'l' },
    ],
  },
  sameer: { name: 'Sameer Shiwakoti', role: 'Frontend', initials: 'SS', color: '#C0392B', tc: '#fff',
    tasks: [
      { id: 'S1-03', desc: 'Initialize React + Vite project, configure Tailwind CSS, set up routing and folder structure', p: 'h' },
      { id: 'S1-10', desc: 'Build Register and Login pages in React with form validation', p: 'h' },
      { id: 'S1-11', desc: 'Build campus feed page UI with post cards, category tags, sort tabs', p: 'm' },
      { id: 'S1-13', desc: 'Build top navbar component with search bar, navigation, responsive menu', p: 'l' },
    ],
  },
  johnson: { name: 'Johnson KC', role: 'Full Stack', initials: 'JK', color: '#D4962A', tc: '#0B1D34',
    tasks: [
      { id: 'S1-02', desc: 'Set up MySQL on AWS RDS, configure SQLAlchemy ORM, Alembic migrations, create all tables', p: 'h' },
      { id: 'S1-05', desc: 'Build registration API endpoint (email + password), hash passwords with bcrypt', p: 'h' },
      { id: 'S1-06', desc: 'Build login API endpoint, JWT token generation and validation middleware', p: 'h' },
      { id: 'S1-07', desc: 'Build user profile API + frontend profile page (full stack)', p: 'm' },
    ],
  },
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
}

const PRI_STYLES = {
  h: 'bg-[#F5D5D0] text-[#8B1A1A]',
  m: 'bg-gold-pale text-[#8B6914]',
  l: 'bg-[#D0EDE9] text-[#0F5E54]',
}
const PRI_LABELS = { h: 'High', m: 'Medium', l: 'Low' }

function Home() {
  const [activeSort, setActiveSort] = useState('new')
  const [activeFilter, setActiveFilter] = useState('All')
  const [showIdea, setShowIdea] = useState(true)
  const [taskPanel, setTaskPanel] = useState(null)
  const [checkedTasks, setCheckedTasks] = useState({})
  const [showNewPost, setShowNewPost] = useState(false)
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [trending, setTrending] = useState([])
  const [events, setEvents] = useState([])
  const [groups, setGroups] = useState([])
  const [sidebarLoading, setSidebarLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setSidebarLoading(true)
    Promise.all([
      apiFetch('/api/trending').catch(() => []),
      apiFetch('/api/events').catch(() => []),
      apiFetch('/api/groups').catch(() => []),
    ]).then(([t, e, g]) => {
      if (cancelled) return
      setTrending(t || [])
      setEvents(e || [])
      setGroups(g || [])
    }).finally(() => { if (!cancelled) setSidebarLoading(false) })
    return () => { cancelled = true }
  }, [reloadKey])

  const sortParam = activeSort === 'new' ? 'newest' : activeSort
  const categoryParam = activeFilter === 'All' ? null : activeFilter.toLowerCase()

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

  const toggleTask = (id) => {
    setCheckedTasks((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const teamMember = taskPanel ? TEAM_DATA[taskPanel] : null

  return (
    <div>
      {/* Header */}
      <div className="bg-navy px-6 pt-10 pb-11">
        <div className="max-w-[1080px] mx-auto flex justify-between items-end gap-10 flex-col md:flex-row md:items-end">
          <div className="max-w-[560px]">
            <h1 className="font-archivo font-black text-[2.8rem] md:text-[2.8rem] text-white leading-[1.05] tracking-tight uppercase">
              What's happening <span className="text-gold block">at Morgan State</span>
            </h1>
            <p className="text-white/50 text-[0.92rem] mt-3 leading-relaxed max-w-[420px]">
              Posts, study groups, events, and opportunities. All in one place, by students, for students.
            </p>
          </div>
          <div className="flex gap-8">
            <HeaderNum value="1,247" label="Students" />
            <HeaderNum value="86" label="Groups" />
            <HeaderNum value="324" label="Posts Today" />
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      {/* Feed + Sidebar */}
      <div className="max-w-[1080px] mx-auto px-6 py-7 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-7" id="feed">
        {/* Main Feed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-archivo font-extrabold text-[0.85rem] uppercase tracking-widest text-gray">Campus Feed</h2>
            <div className="flex">
              {['new', 'popular', 'trending'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSort(tab)}
                  className={`font-archivo text-[0.72rem] font-bold uppercase tracking-wide py-[5px] px-2.5 border border-lightgray cursor-pointer first:rounded-l last:rounded-r ${
                    activeSort === tab ? 'bg-navy text-white border-navy' : 'bg-card text-gray'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 mb-[18px]">
            {FEED_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-[0.7rem] font-semibold py-1 px-2.5 border rounded-[3px] cursor-pointer uppercase tracking-wide transition-colors ${
                  activeFilter === f
                    ? 'bg-gold-pale border-gold text-[#8B6914]'
                    : 'bg-card border-lightgray text-gray hover:border-ink hover:text-ink'
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
          ) : posts.length === 0 ? (
            <EmptyState
              icon={activeFilter === 'All' ? '✍️' : '🔍'}
              title={activeFilter === 'All' ? 'The feed is empty' : `No ${activeFilter} posts yet`}
              body={activeFilter === 'All'
                ? 'Be the first to post. Pick a category, share what\u2019s on your mind, hit send.'
                : `Switch the filter or be the first to post in ${activeFilter}.`}
              action={
                <button
                  onClick={() => setShowNewPost(true)}
                  className="bg-gold text-navy border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors"
                >
                  + Create a post
                </button>
              }
            />
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>

        {/* Sidebar */}
        <aside>
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

          {/* Events */}
          <SideBox title="Events" id="events">
            {sidebarLoading ? (
              <SidebarSkeleton count={3} />
            ) : events.length === 0 ? (
              <div className="px-4 py-3 text-[0.78rem] text-gray">No upcoming events.</div>
            ) : events.map((ev) => {
              const { month, day, weekday } = eventDateParts(ev.event_date)
              const detail = [ev.location, ev.start_time].filter(Boolean).join(' \u00B7 ')
              return (
                <div key={ev.id} className="flex gap-3 px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 items-center hover:bg-offwhite transition-colors">
                  <div className="w-[44px] shrink-0 border border-lightgray bg-white overflow-hidden">
                    <div className="bg-navy text-gold text-[0.52rem] uppercase tracking-wider font-archivo font-extrabold text-center py-[2px]">{weekday || month}</div>
                    <div className="text-center py-[3px]">
                      <div className="font-archivo font-black text-navy text-[1.15rem] leading-none">{day}</div>
                      <div className="text-[0.5rem] uppercase tracking-wider text-gray font-archivo font-bold mt-[1px]">{month}</div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[0.82rem] font-semibold leading-tight truncate">{ev.title}</div>
                    <div className="text-[0.68rem] text-gray truncate">{detail || '\u2014'}</div>
                  </div>
                </div>
              )
            })}
          </SideBox>

          {/* Groups */}
          <SideBox title="Your Groups" id="groups">
            {sidebarLoading ? (
              <SidebarSkeleton count={3} />
            ) : groups.length === 0 ? (
              <div className="px-4 py-3 text-[0.78rem] text-gray">No groups yet.</div>
            ) : groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 hover:bg-offwhite transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  {g.course_code && (
                    <span className={`font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-[7px] rounded-sm shrink-0 ${pillForCourse(g.course_code)}`}>
                      {g.course_code}
                    </span>
                  )}
                  <div className="text-[0.82rem] font-semibold truncate">{g.name}</div>
                </div>
                <span className="font-archivo text-[0.62rem] font-extrabold text-gray flex items-center gap-1 shrink-0">
                  <span aria-hidden="true">&#128100;</span>{g.member_count}
                </span>
              </div>
            ))}
          </SideBox>
        </aside>
      </div>

      {/* Idea Banner */}
      {showIdea && (
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="bg-navy px-5 py-4 flex items-center gap-3.5">
            <div className="text-[1.3rem]">&#128161;</div>
            <div className="flex-1 text-white/70 text-[0.85rem]">
              <b className="text-gold">Got a new idea?</b> Add it to the Trello board and sprint backlog so the team can review it.
            </div>
            <a
              href="https://trello.com/b/ZVVEpSeC/my-trello-board"
              target="_blank"
              rel="noreferrer"
              className="font-archivo font-extrabold text-[0.72rem] uppercase tracking-wide bg-gold text-navy px-[18px] py-[9px] no-underline hover:bg-[#E5A92E] transition-colors shrink-0"
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
      <div className="max-w-[1080px] mx-auto px-6 pt-8" id="team">
        <h2 className="font-archivo font-black text-[0.85rem] uppercase tracking-widest text-navy">The Team</h2>
        <p className="text-[0.78rem] text-gray mt-1">COSC 458 - Software Engineering &middot; Spring 2026 &middot; Click a name to see their tasks</p>
      </div>
      <div className="max-w-[1080px] mx-auto px-6 pb-8 pt-3.5 grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(TEAM_DATA).map(([key, m]) => (
          <div
            key={key}
            onClick={() => setTaskPanel(key)}
            className="bg-card border border-lightgray p-4 text-center cursor-pointer hover:border-gold transition-colors"
          >
            <div
              className="w-10 h-10 rounded-[3px] flex items-center justify-center font-archivo font-extrabold text-[0.72rem] mx-auto mb-2"
              style={{ background: m.color, color: m.tc }}
            >
              {m.initials}
            </div>
            <div className="font-archivo font-bold text-[0.78rem]">{m.name}</div>
            <div className="text-[0.65rem] text-gray mt-[2px]">{m.role}</div>
          </div>
        ))}
      </div>

      {/* Task Overlay */}
      {taskPanel && teamMember && (
        <div
          className="fixed inset-0 bg-navy/60 z-[200] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setTaskPanel(null) }}
        >
          <div className="bg-card w-[90%] max-w-[600px] max-h-[75vh] overflow-y-auto border border-lightgray">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EAE7E0] bg-offwhite sticky top-0 z-[1]">
              <div
                className="w-[38px] h-[38px] rounded-[3px] flex items-center justify-center font-archivo font-extrabold text-[0.75rem] shrink-0"
                style={{ background: teamMember.color, color: teamMember.tc }}
              >
                {teamMember.initials}
              </div>
              <div>
                <h3 className="font-archivo font-extrabold text-[1rem]">{teamMember.name}</h3>
                <div className="text-[0.72rem] text-gray">{teamMember.role} &bull; Sprint 1</div>
              </div>
              <button
                onClick={() => setTaskPanel(null)}
                className="ml-auto bg-transparent border-none text-[1.3rem] cursor-pointer text-gray hover:text-ink p-1"
              >
                &times;
              </button>
            </div>
            <div className="px-5 py-3">
              {teamMember.tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5 py-2.5 border-b border-[#EAE7E0] last:border-b-0">
                  <div
                    onClick={() => toggleTask(t.id)}
                    className={`w-[18px] h-[18px] border-2 rounded-sm shrink-0 mt-[1px] cursor-pointer flex items-center justify-center text-[0.65rem] transition-colors ${
                      checkedTasks[t.id]
                        ? 'bg-navy border-navy text-white'
                        : 'border-lightgray text-transparent hover:border-navy'
                    }`}
                  >
                    {checkedTasks[t.id] ? '\u2713' : ''}
                  </div>
                  <div className="flex-1">
                    <div className="font-archivo text-[0.62rem] font-extrabold text-gold tracking-wide">{t.id}</div>
                    <div className="text-[0.85rem] font-medium my-[1px] leading-snug">{t.desc}</div>
                    <span className={`font-archivo text-[0.6rem] font-bold uppercase tracking-wide py-[2px] px-[7px] rounded-sm ${PRI_STYLES[t.p]}`}>
                      {PRI_LABELS[t.p]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-navy py-5 text-center text-white/30 text-[0.72rem]">
        BearBoard &copy; 2026 &middot; COSC 458 Software Engineering &middot; Morgan State University &middot;{' '}
        <a href="https://trello.com/b/ZVVEpSeC/my-trello-board" target="_blank" rel="noreferrer" className="text-gold no-underline">
          Trello
        </a>
      </footer>

      {/* New Post FAB */}
      <button
        onClick={() => setShowNewPost(true)}
        className="fixed bottom-[84px] right-6 bg-gold text-navy border-none py-3 px-5 font-archivo text-[0.75rem] font-extrabold uppercase tracking-wide cursor-pointer z-50 flex items-center gap-1.5 hover:bg-[#E5A92E] transition-colors"
      >
        + New Post
      </button>

      <NewPostModal
        open={showNewPost}
        onClose={() => setShowNewPost(false)}
        onCreated={() => setReloadKey((k) => k + 1)}
      />

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  )
}

function HeaderNum({ value, label }) {
  return (
    <div className="text-right">
      <div className="font-archivo font-black text-[2rem] text-gold leading-none tracking-tight">{value}</div>
      <div className="text-white/35 text-[0.68rem] uppercase tracking-widest font-semibold mt-1">{label}</div>
    </div>
  )
}

function SideBox({ title, children, id }) {
  return (
    <div className="border border-lightgray bg-card mb-3.5 overflow-hidden" id={id}>
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

  const applyVote = async (voteType) => {
    if (pending) return
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
      setVoteError(err.status === 401 ? 'Log in to vote' : 'Vote failed')
    } finally {
      setPending(false)
    }
  }

  const upActive = userVote === 'up'
  const downActive = userVote === 'down'

  return (
    <div className={`group bg-card border border-lightgray border-l-[3px] mb-2.5 transition-all duration-150 hover:shadow-[0_4px_18px_-8px_rgba(11,29,52,0.18)] hover:-translate-y-[1px] ${
      isEvent ? 'border-l-gold' : 'border-l-lightgray hover:border-l-gold'
    }`}>
      <div className="px-[18px] py-4">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            className="w-9 h-9 rounded-[4px] flex items-center justify-center font-archivo font-black text-[0.7rem] shrink-0 ring-1 ring-black/5"
            style={{ background: avatar.bg, color: avatar.tc }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <strong className="text-[0.85rem] font-semibold block leading-tight truncate">{authorName}</strong>
            <small className="text-[0.7rem] text-gray block truncate">
              {authorMajor && <>{authorMajor} &middot; </>}{formatRelativeTime(post.created_at)}
            </small>
          </div>
          {isEvent && (
            <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-gold text-navy flex items-center gap-1 shrink-0">
              <span aria-hidden="true">&#128197;</span> Event
            </span>
          )}
          <span className={`font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm shrink-0 ${catClass}`}>
            {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
          </span>
        </div>
        <Link to={`/post/${post.id}`} className="no-underline text-ink block group/title">
          <h3 className="font-archivo font-bold text-[1.02rem] leading-snug mb-1.5 tracking-tight group-hover/title:text-navy transition-colors">
            {post.title}
          </h3>
        </Link>
        {isEvent && eventLabel && (
          <div className="bg-gold-pale border-l-[3px] border-gold px-3 py-2 mb-2 font-archivo font-bold text-[0.8rem] text-[#8B6914] flex items-center gap-2">
            <span aria-hidden="true">&#9200;</span> {eventLabel}
          </div>
        )}
        <div className="text-[0.85rem] text-gray leading-relaxed mb-3 whitespace-pre-wrap line-clamp-3">{post.body}</div>
        <div className="flex items-center gap-3 pt-2.5 border-t border-[#EAE7E0]">
          <div className="flex items-center gap-0.5 font-archivo bg-offwhite border border-lightgray rounded-sm">
            <button
              onClick={() => applyVote('up')}
              aria-label="Upvote"
              aria-pressed={upActive}
              disabled={pending}
              className={`bg-transparent border-none cursor-pointer text-[0.85rem] px-2 py-[5px] transition-colors disabled:cursor-wait ${
                upActive ? 'text-gold' : 'text-lightgray hover:text-navy'
              }`}
            >
              &#9650;
            </button>
            <span
              key={popKey}
              className={`font-extrabold text-[0.78rem] min-w-[22px] text-center vote-pop ${
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
              className={`bg-transparent border-none cursor-pointer text-[0.85rem] px-2 py-[5px] transition-colors disabled:cursor-wait ${
                downActive ? 'text-[#8B1A1A]' : 'text-lightgray hover:text-navy'
              }`}
            >
              &#9660;
            </button>
          </div>
          <Link
            to={`/post/${post.id}`}
            className="text-[0.75rem] text-gray no-underline font-franklin hover:text-ink flex items-center gap-1"
          >
            <span aria-hidden="true">&#128488;</span> {post.comment_count ?? 0}
          </Link>
          <button className="text-[0.75rem] text-gray cursor-pointer bg-transparent border-none font-franklin hover:text-ink">Bookmark</button>
          <button className="text-[0.75rem] text-gray cursor-pointer bg-transparent border-none font-franklin hover:text-ink">Share</button>
          {voteError && <span className="text-[0.7rem] text-[#8B1A1A] ml-auto font-archivo font-bold">{voteError}</span>}
        </div>
      </div>
    </div>
  )
}

export default Home
