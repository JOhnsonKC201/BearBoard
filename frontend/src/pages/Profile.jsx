import { useParams } from 'react-router-dom'

function Profile() {
  const { id } = useParams()

  // TODO: Fetch user data from GET /api/users/{id}
  const user = {
    name: 'Johnson KC',
    email: 'johnsonkc@morgan.edu',
    major: 'Computer Science',
    graduation_year: 2026,
    karma: 25,
    initials: 'JK',
    color: '#D4962A',
    tc: '#0B1D34',
  }

  const userPosts = [
    { id: 5, title: 'Best quiet spots to code on campus?', category: 'General', votes: 22, comments: 15, time: '1d ago' },
  ]

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Profile header */}
      <div className="bg-navy px-6 py-8">
        <div className="max-w-[700px] mx-auto flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-[3px] flex items-center justify-center font-archivo font-black text-[1.3rem] shrink-0"
            style={{ background: user.color, color: user.tc }}
          >
            {user.initials}
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
            <InfoItem label="Major" value={user.major} />
            <InfoItem label="Class of" value={user.graduation_year} />
            <InfoItem label="Karma" value={user.karma} />
            <InfoItem label="User ID" value={`#${id}`} />
          </div>
          {/* TODO: Add "Edit Profile" button/modal for own profile */}
        </div>

        {/* User posts */}
        <h2 className="font-archivo font-extrabold text-[0.75rem] uppercase tracking-widest text-gray mb-3">Posts</h2>
        {userPosts.map((post) => (
          <div key={post.id} className="bg-card border border-lightgray border-l-[3px] border-l-lightgray hover:border-l-gold px-[18px] py-4 mb-2 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-[#E5E3DE] text-[#5A5A5A]">
                {post.category}
              </span>
              <span className="text-[0.7rem] text-gray">{post.time}</span>
            </div>
            <h3 className="font-archivo font-bold text-[1rem] leading-snug mb-1">{post.title}</h3>
            <div className="flex items-center gap-3 text-[0.75rem] text-gray">
              <span>{post.votes} votes</span>
              <span>{post.comments} comments</span>
            </div>
          </div>
        ))}
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
