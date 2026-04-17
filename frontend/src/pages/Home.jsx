import { useState } from 'react'
import ChatWidget from '../components/ChatWidget'

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

const TRENDING = [
  { rank: 1, title: 'Yard Fest Weekend Plans', upvotes: 89, comments: 34 },
  { rank: 2, title: 'JPMorgan Internship Apps', upvotes: 64, comments: 23 },
  { rank: 3, title: 'Spring Career Fair Details', upvotes: 47, comments: 12 },
]

const EVENTS = [
  { month: 'Apr', day: '18', title: 'Yard Fest 2026', detail: 'Main Yard \u00B7 12-8 PM' },
  { month: 'Apr', day: '22', title: 'Spring Career Fair', detail: 'Student Center \u00B7 10 AM-3 PM' },
  { month: 'Apr', day: '25', title: 'Hackathon Kickoff', detail: 'SCMNS 201 \u00B7 6 PM' },
]

const GROUPS = [
  { name: 'Networking Gang', code: 'COSC 350', count: 12 },
  { name: 'SWE Study Group', code: 'COSC 458', count: 6 },
  { name: 'Bio 201 Crew', code: 'BIOL 201', count: 18 },
]

const CAT_STYLES = {
  events: 'bg-gold-pale text-[#8B6914]',
  academic: 'bg-[#D1E3F5] text-navy',
  recruiters: 'bg-[#E6D8F0] text-purple',
  social: 'bg-[#D0EDE9] text-[#0F5E54]',
  general: 'bg-[#E5E3DE] text-[#5A5A5A]',
}

const PRI_STYLES = {
  h: 'bg-[#F5D5D0] text-[#8B1A1A]',
  m: 'bg-gold-pale text-[#8B6914]',
  l: 'bg-[#D0EDE9] text-[#0F5E54]',
}
const PRI_LABELS = { h: 'High', m: 'Medium', l: 'Low' }

function Home() {
  const [activeSort, setActiveSort] = useState('new')
  const [activeFilter, setActiveFilter] = useState('events')
  const [showIdea, setShowIdea] = useState(true)
  const [taskPanel, setTaskPanel] = useState(null)
  const [checkedTasks, setCheckedTasks] = useState({})

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
            {/* Sort tabs — pill segmented control */}
            <div className="flex bg-offwhite border border-lightgray rounded-full p-[3px] gap-[2px]">
              {['new', 'popular', 'trending'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSort(tab)}
                  className={`font-archivo text-[0.72rem] font-bold uppercase tracking-wide py-[5px] px-3 rounded-full cursor-pointer transition-all ${
                    activeSort === tab ? 'bg-navy text-white shadow-sm' : 'text-gray hover:text-ink'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter — pill chips */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {['events', 'academic', 'recruiters', 'social', 'general'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-[0.7rem] font-semibold py-1.5 px-3.5 rounded-full cursor-pointer uppercase tracking-wide transition-all ${
                  activeFilter === f
                    ? 'bg-gold-pale border border-gold text-[#8B6914]'
                    : 'bg-card border border-lightgray text-gray hover:border-ink hover:text-ink'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Posts */}
          {SAMPLE_POSTS.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {/* Sidebar */}
        <aside>
          {/* Trending */}
          <SideBox title="Trending" id="trending-box">
            {TRENDING.map((t) => (
              <div key={t.rank} className="px-4 py-2.5 border-b border-[#EAE7E0] last:border-b-0">
                <div className="font-archivo font-extrabold text-[0.62rem] text-gold tracking-wide">#{t.rank}</div>
                <div className="text-[0.82rem] font-semibold my-[1px]">{t.title}</div>
                <div className="text-[0.68rem] text-gray">{t.upvotes} upvotes &middot; {t.comments} comments</div>
              </div>
            ))}
          </SideBox>

          {/* Events */}
          <SideBox title="Events" id="events">
            {EVENTS.map((ev, i) => (
              <div key={i} className="flex gap-3 px-4 py-2.5 border-b border-[#EAE7E0] last:border-b-0 items-center">
                <div className="w-[42px] h-[42px] bg-navy text-white flex flex-col items-center justify-center shrink-0 rounded-lg">
                  <span className="text-[0.55rem] uppercase tracking-wide opacity-60">{ev.month}</span>
                  <span className="font-archivo font-black text-[1.05rem] leading-none">{ev.day}</span>
                </div>
                <div>
                  <div className="text-[0.82rem] font-semibold">{ev.title}</div>
                  <div className="text-[0.68rem] text-gray">{ev.detail}</div>
                </div>
              </div>
            ))}
          </SideBox>

          {/* Groups */}
          <SideBox title="Your Groups" id="groups">
            {GROUPS.map((g, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-[9px] border-b border-[#EAE7E0] last:border-b-0">
                <div>
                  <div className="text-[0.82rem] font-semibold">{g.name}</div>
                  <div className="text-[0.68rem] text-gray">{g.code}</div>
                </div>
                <span className="font-archivo text-[0.62rem] font-bold text-navy bg-[#D1E3F5] py-[2px] px-[9px] rounded-full">{g.count}</span>
              </div>
            ))}
          </SideBox>
        </aside>
      </div>

      {/* Idea Banner */}
      {showIdea && (
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="bg-navy px-5 py-4 flex items-center gap-3.5 rounded-xl">
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
      <div className="max-w-[1080px] mx-auto px-6 pt-8" id="team">
        <h2 className="font-archivo font-black text-[0.85rem] uppercase tracking-widest text-navy">The Team</h2>
        <p className="text-[0.78rem] text-gray mt-1">COSC 458 - Software Engineering &middot; Spring 2026 &middot; Click a name to see their tasks</p>
      </div>
      <div className="max-w-[1080px] mx-auto px-6 pb-8 pt-3.5 grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(TEAM_DATA).map(([key, m]) => (
          <div
            key={key}
            onClick={() => setTaskPanel(key)}
            className="bg-card border border-lightgray rounded-xl p-4 text-center cursor-pointer hover:border-gold hover:shadow-md transition-all"
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

      {/* Task Overlay */}
      {taskPanel && teamMember && (
        <div
          className="fixed inset-0 bg-navy/60 z-[200] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setTaskPanel(null) }}
        >
          <div className="bg-card w-[90%] max-w-[600px] max-h-[75vh] overflow-y-auto border border-lightgray rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EAE7E0] bg-offwhite sticky top-0 z-[1]">
              <div
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-archivo font-extrabold text-[0.75rem] shrink-0"
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
                    className={`w-[18px] h-[18px] border-2 rounded-full shrink-0 mt-[1px] cursor-pointer flex items-center justify-center text-[0.65rem] transition-colors ${
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
                    <span className={`font-archivo text-[0.6rem] font-bold uppercase tracking-wide py-[2px] px-[9px] rounded-full ${PRI_STYLES[t.p]}`}>
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
      <button className="fixed bottom-[84px] right-6 bg-gold text-navy border-none py-3 px-5 font-archivo text-[0.75rem] font-extrabold uppercase tracking-wide cursor-pointer z-50 flex items-center gap-1.5 hover:bg-[#E5A92E] transition-all rounded-full shadow-lg hover:-translate-y-0.5">
        + New Post
      </button>

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
    <div className="border border-lightgray bg-card mb-3.5 overflow-hidden rounded-xl shadow-sm" id={id}>
      <div className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest px-4 py-3 bg-navy text-gold">
        {title}
      </div>
      {children}
    </div>
  )
}

function PostCard({ post }) {
  const [votes, setVotes] = useState(post.votes)
  const [userVote, setUserVote] = useState(null)
  const catClass = CAT_STYLES[post.category] || CAT_STYLES.general

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
    <div className="bg-card border border-lightgray rounded-xl border-l-[3px] border-l-lightgray hover:border-l-gold mb-3 px-[18px] py-4 transition-all shadow-sm hover:shadow-md">
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-archivo font-extrabold text-[0.65rem] text-white shrink-0"
          style={{ background: post.color, color: post.tc || '#fff' }}
        >
          {post.initials}
        </div>
        <div className="flex-1">
          <strong className="text-[0.85rem] font-semibold block leading-tight">{post.name}</strong>
          <small className="text-[0.7rem] text-gray">{post.dept} &middot; {post.time}</small>
        </div>
        <span className={`font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider py-[3px] px-3 rounded-full ${catClass}`}>
          {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
        </span>
      </div>
      <h3 className="font-archivo font-bold text-[1rem] leading-snug mb-1.5 tracking-tight">{post.title}</h3>
      <div className="text-[0.85rem] text-gray leading-relaxed mb-2.5">{post.body}</div>
      <div className="flex items-center gap-3.5 pt-2 border-t border-[#EAE7E0]">
        <div className="flex items-center gap-1 font-archivo">
          <button
            onClick={() => vote('up')}
            className={`bg-transparent border-none cursor-pointer text-[0.75rem] p-[2px] transition-colors ${userVote === 'up' ? 'text-gold' : 'text-lightgray hover:text-ink'}`}
          >
            &#9650;
          </button>
          <span className={`font-extrabold text-[0.82rem] min-w-[22px] text-center transition-colors ${userVote === 'up' ? 'text-gold' : userVote === 'down' ? 'text-red' : 'text-ink'}`}>
            {votes}
          </span>
          <button
            onClick={() => vote('down')}
            className={`bg-transparent border-none cursor-pointer text-[0.75rem] p-[2px] transition-colors ${userVote === 'down' ? 'text-red' : 'text-lightgray hover:text-ink'}`}
          >
            &#9660;
          </button>
        </div>
        <button className="text-[0.75rem] text-gray cursor-pointer bg-transparent border-none font-franklin hover:text-ink">{post.comments} comments</button>
        <button className="text-[0.75rem] text-gray cursor-pointer bg-transparent border-none font-franklin hover:text-ink">Bookmark</button>
        <button className="text-[0.75rem] text-gray cursor-pointer bg-transparent border-none font-franklin hover:text-ink">Share</button>
      </div>
    </div>
  )
}

export default Home
