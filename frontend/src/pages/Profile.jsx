import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { ProfileSkeleton } from '../components/Skeletons'
import RoleBadge from '../components/RoleBadge'
import AdminDashboard from '../components/AdminDashboard'
import { useAuth } from '../context/AuthContext'
import { initialsFor as getInitials, formatRelativeTime as formatTimeAgo } from '../utils/format'
import { catClassFor } from '../utils/avatar'
import { IconCaretUp, IconChat, IconSiren, IconCalendar } from '../components/ActionIcons'

// Reddit-subreddit-style profile page. Each user gets: banner + overlapping
// avatar + about sidebar + their post feed in the main column.
//
// Profile has its own palette because entries carry a banner gradient the
// shared AVATAR_PALETTE doesn't define (that one is for round avatars in
// the feed). Same seeds are used so the same user still maps consistently.
const PROFILE_PALETTE = [
  { color: '#5B3A8C', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #6B4AA0 0%, #2A1C4D 100%)' },
  { color: '#0B1D34', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #19314F 0%, #050D1C 100%)' },
  { color: '#1A8A7D', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #2BA89A 0%, #0A4A43 100%)' },
  { color: '#C0392B', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #D45347 0%, #6B1F16 100%)' },
  { color: '#D4962A', tc: '#0B1D34', banner: 'linear-gradient(135deg, #EAA841 0%, #8A5A0F 100%)' },
  { color: '#2C5F2D', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #4A8A4D 0%, #1A3A1B 100%)' },
]

function getAvatar(user) {
  const seed = (user?.id ?? 0) % PROFILE_PALETTE.length
  return PROFILE_PALETTE[seed]
}

function formatJoinDate(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function Profile() {
  const { id } = useParams()
  const { user: currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('posts')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      apiFetch(`/api/users/${id}`),
      apiFetch(`/api/posts?author_id=${id}`),
    ])
      .then(([userData, postsData]) => {
        if (cancelled) return
        setUser(userData)
        setPosts(postsData)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Failed to load profile')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id])

  if (loading) return <ProfileSkeleton />

  if (error || !user) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <p className="text-gray font-archivo">{error || 'User not found'}</p>
      </div>
    )
  }

  const avatar = getAvatar(user)
  const initials = getInitials(user.name)
  const isSelf = currentUser?.id === user.id
  const totalVotes = posts.reduce((sum, p) => sum + ((p.upvotes ?? 0) - (p.downvotes ?? 0)), 0)

  return (
    <div className="min-h-screen bg-offwhite pb-10">
      {/* Banner */}
      <div
        className="h-[160px] md:h-[180px] w-full relative"
        style={{ background: avatar.banner }}
      >
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 14px, rgba(255,255,255,0.35) 14px 16px)'
        }} />
      </div>

      {/* Header strip with overlapping avatar */}
      <div className="bg-card border-b border-lightgray">
        <div className="max-w-[1040px] mx-auto px-6 relative">
          <div className="flex flex-col md:flex-row md:items-end md:gap-5 -mt-[54px] md:-mt-[50px]">
            <div
              className="w-[108px] h-[108px] rounded-full flex items-center justify-center font-archivo font-black text-[2rem] shrink-0 ring-4 ring-card shadow-[0_4px_20px_-6px_rgba(11,29,52,0.35)]"
              style={{ background: avatar.color, color: avatar.tc }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0 mt-3 md:mt-0 md:pb-3 md:pl-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-archivo font-black text-[1.6rem] text-navy uppercase tracking-tight leading-none">
                  {user.name}
                </h1>
                <RoleBadge role={user.role} size="lg" />
              </div>
              <div className="text-[0.78rem] text-gray mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-archivo font-bold">u/{(user.name || '').split(/\s+/)[0]?.toLowerCase() || 'student'}</span>
                {user.major && <><span>&middot;</span><span>{user.major}</span></>}
                {user.graduation_year && <><span>&middot;</span><span>Class of {user.graduation_year}</span></>}
              </div>
            </div>
            <div className="flex gap-2 mt-3 md:mt-0 md:pb-3">
              {!isSelf && (
                <>
                  <button className="bg-navy text-white border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide rounded-full hover:bg-[#0a182b] transition-colors cursor-pointer">
                    + Follow
                  </button>
                  <button className="bg-card border border-lightgray py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide rounded-full text-gray hover:text-ink hover:border-navy transition-colors cursor-pointer">
                    Message
                  </button>
                </>
              )}
              {isSelf && (
                <button className="bg-gold text-navy border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide rounded-full hover:bg-[#E5A92E] transition-colors cursor-pointer">
                  Edit profile
                </button>
              )}
              <button className="bg-card border border-lightgray w-9 h-9 rounded-full text-gray hover:text-ink hover:border-navy transition-colors cursor-pointer flex items-center justify-center" title="Share">
                <span aria-hidden="true">&#8599;</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 border-t border-[#EAE7E0] pt-2">
            {['posts', 'comments', 'about'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide py-2 px-4 rounded-full cursor-pointer transition-colors ${
                  tab === t
                    ? 'bg-navy text-white'
                    : 'text-gray hover:text-ink hover:bg-offwhite'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
        {/* Main column */}
        <div>
          {isSelf && currentUser?.role === 'admin' && <AdminDashboard />}

          {tab === 'posts' && (
            posts.length === 0 ? (
              <div className="bg-card border border-lightgray p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 text-gray/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="w-full h-full">
                    <path d="M19 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6z" />
                    <path d="M9 9h8M9 13h8M9 17h5" />
                  </svg>
                </div>
                <div className="font-archivo font-extrabold text-[1rem] text-navy mb-1">No posts yet</div>
                <div className="text-[0.82rem] text-gray">
                  {isSelf ? "You haven't posted anything. Head back to the feed and start the conversation." : `${user.name} hasn't posted anything yet.`}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {posts.map((post) => {
                  const cat = (post.category || 'general').toLowerCase()
                  const catCls = catClassFor(cat)
                  const score = (post.upvotes ?? 0) - (post.downvotes ?? 0)
                  return (
                    <Link
                      key={post.id}
                      to={`/post/${post.id}`}
                      className="block bg-card border border-lightgray border-l-[3px] border-l-lightgray hover:border-l-gold hover:shadow-[0_4px_18px_-8px_rgba(11,29,52,0.18)] hover:-translate-y-[1px] transition-all no-underline text-ink overflow-hidden"
                    >
                      <div className="px-[18px] pt-3.5 pb-3">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full ${catCls}`}>
                            {post.category}
                          </span>
                          <span className="text-[0.7rem] text-gray font-archivo">{formatTimeAgo(post.created_at)}</span>
                          {post.is_sos && !post.sos_resolved && (
                            <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full bg-danger text-white flex items-center gap-1">
                              <IconSiren /> SOS
                            </span>
                          )}
                        </div>
                        <h3 className="font-archivo font-bold text-[1.05rem] leading-snug tracking-tight mb-1">
                          {post.title}
                        </h3>
                        {post.body && (
                          <p className="text-[0.82rem] text-gray leading-relaxed line-clamp-2">{post.body}</p>
                        )}
                      </div>
                      {post.image_url && (
                        <div className="bg-black/80 overflow-hidden">
                          <img
                            src={post.image_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full max-h-[320px] object-contain mx-auto"
                          />
                        </div>
                      )}
                      <div className="px-[18px] py-2.5 border-t border-divider flex items-center gap-3 text-[0.72rem] text-gray font-archivo font-bold">
                        <span className="flex items-center gap-1.5 text-gold">
                          <IconCaretUp filled />
                          <span className="text-ink">{score}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconChat />
                          <span>{post.comment_count ?? 0}</span>
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          )}

          {tab === 'comments' && (
            <div className="bg-card border border-lightgray p-8 text-center">
              <div className="w-10 h-10 mx-auto mb-3 text-gray/60">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="w-full h-full">
                  <path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" />
                </svg>
              </div>
              <div className="font-archivo font-extrabold text-[1rem] text-navy mb-1">Comment history</div>
              <div className="text-[0.82rem] text-gray">Coming soon. We'll show every comment {isSelf ? 'you' : user.name} has left here.</div>
            </div>
          )}

          {tab === 'about' && (
            <div className="bg-card border border-lightgray p-6">
              <h2 className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest text-gray mb-4">About</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.88rem]">
                <InfoRow label="Full name" value={user.name} />
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Major" value={user.major || '-'} />
                <InfoRow label="Class of" value={user.graduation_year || '-'} />
                <InfoRow label="Role" value={(user.role || 'student').charAt(0).toUpperCase() + (user.role || 'student').slice(1)} />
                <InfoRow label="Joined" value={formatJoinDate(user.created_at)} />
              </div>
            </div>
          )}
        </div>

        {/* About sidebar */}
        <aside className="space-y-4">
          <div className="bg-card border border-lightgray overflow-hidden">
            <div className="bg-navy text-gold px-4 py-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest">
              About u/{(user.name || '').split(/\s+/)[0]?.toLowerCase() || 'student'}
            </div>
            <div className="px-4 py-4 text-[0.85rem] text-ink leading-relaxed">
              {user.major
                ? `Studying ${user.major}${user.graduation_year ? `, Class of ${user.graduation_year}` : ''} at Morgan State.`
                : 'Morgan State student on BearBoard.'}
            </div>
            <div className="grid grid-cols-2 border-t border-[#EAE7E0]">
              <SideStat label="Karma" value={user.karma ?? 0} />
              <SideStat label="Posts" value={posts.length} />
              <SideStat
                label="Streak"
                value={<span className="flex items-center gap-1 justify-center"><span aria-hidden="true">{(user.streak_count ?? 0) > 0 ? '🔥' : '·'}</span><span>{user.streak_count ?? 0}d</span></span>}
                border="border-t"
              />
              <SideStat label="Upvotes" value={totalVotes} border="border-t border-l" />
            </div>
            <div className="px-4 py-3 border-t border-[#EAE7E0] text-[0.72rem] text-gray">
              <div className="flex items-center gap-1.5">
                <IconCalendar />
                <span>Joined {formatJoinDate(user.created_at) || 'recently'}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-lightgray overflow-hidden">
            <div className="bg-navy text-gold px-4 py-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest">
              Community guidelines
            </div>
            <ol className="px-4 py-3 space-y-2.5 text-[0.78rem] text-ink/80 list-decimal pl-7">
              <li>Be kind. Morgan students are your classmates first.</li>
              <li>No spam, self-promo, or off-campus resale.</li>
              <li>Use Anonymous category for sensitive topics.</li>
              <li>SOS posts are for real help requests only.</li>
              <li>No harassment, doxxing, or hate speech.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}

function SideStat({ label, value, border = '' }) {
  return (
    <div className={`px-4 py-3 text-center ${border}`}>
      <div className="font-archivo font-black text-[1.2rem] text-navy leading-none">{value}</div>
      <div className="text-[0.58rem] uppercase tracking-widest text-gray font-archivo font-extrabold mt-1">{label}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="font-archivo text-[0.62rem] font-bold uppercase tracking-wide text-gray">{label}</div>
      <div className="text-[0.88rem] font-semibold mt-[2px] break-words">{value}</div>
    </div>
  )
}

export default Profile
