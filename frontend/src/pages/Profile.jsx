import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { ProfileSkeleton } from '../components/Skeletons'

const AVATAR_PALETTE = [
  { color: '#5B3A8C', tc: '#FFFFFF' },
  { color: '#0B1D34', tc: '#FFFFFF' },
  { color: '#1A8A7D', tc: '#FFFFFF' },
  { color: '#C0392B', tc: '#FFFFFF' },
  { color: '#D4962A', tc: '#0B1D34' },
  { color: '#2C5F2D', tc: '#FFFFFF' },
]

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

function getAvatar(user) {
  const seed = (user?.id ?? 0) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[seed]
}

function formatTimeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function Profile() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <ProfileSkeleton />
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <p className="text-gray font-archivo">{error || 'User not found'}</p>
      </div>
    )
  }

  const avatar = getAvatar(user)
  const initials = getInitials(user.name)

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Profile header */}
      <div className="bg-navy px-6 py-8">
        <div className="max-w-[700px] mx-auto flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-[3px] flex items-center justify-center font-archivo font-black text-[1.3rem] shrink-0"
            style={{ background: avatar.color, color: avatar.tc }}
          >
            {initials}
          </div>
          <div>
            <h1 className="font-archivo font-black text-[1.5rem] text-white uppercase tracking-tight">{user.name}</h1>
            <p className="text-white/50 text-[0.82rem]">{user.email}</p>
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      <div className="max-w-[700px] mx-auto px-6 py-6">
        {/* Info card */}
        <div className="bg-card border border-lightgray p-5 mb-5">
          <h2 className="font-archivo font-extrabold text-[0.75rem] uppercase tracking-widest text-gray mb-4">Profile Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Major" value={user.major || '—'} />
            <InfoItem label="Class of" value={user.graduation_year || '—'} />
            <InfoItem label="Karma" value={user.karma ?? 0} />
            <InfoItem label="User ID" value={`#${user.id}`} />
          </div>
        </div>

        {/* User posts */}
        <h2 className="font-archivo font-extrabold text-[0.75rem] uppercase tracking-widest text-gray mb-3">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-gray text-[0.85rem]">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-card border border-lightgray border-l-[3px] border-l-lightgray hover:border-l-gold px-[18px] py-4 mb-2 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-[#E5E3DE] text-[#5A5A5A]">
                  {post.category}
                </span>
                <span className="text-[0.7rem] text-gray">{formatTimeAgo(post.created_at)}</span>
              </div>
              <h3 className="font-archivo font-bold text-[1rem] leading-snug mb-1">{post.title}</h3>
              <div className="flex items-center gap-3 text-[0.75rem] text-gray">
                <span>{(post.upvotes ?? 0) - (post.downvotes ?? 0)} votes</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div className="font-archivo text-[0.62rem] font-bold uppercase tracking-wide text-gray">{label}</div>
      <div className="text-[0.92rem] font-semibold mt-[2px]">{value}</div>
    </div>
  )
}

export default Profile
