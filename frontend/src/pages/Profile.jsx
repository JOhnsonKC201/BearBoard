import { useParams } from 'react-router-dom'

function Profile() {
  const { id } = useParams()

  // TODO: Fetch user data from GET /api/users/{id}
  // Placeholder data for now
  const user = {
    name: "Test User",
    email: "test@morgan.edu",
    major: "Computer Science",
    graduation_year: 2026,
    karma: 25,
  }

  return (
    <div className="mt-10 max-w-2xl mx-auto">
      <div className="bg-white rounded shadow p-6">
        {/* TODO: Add avatar image */}
        <h2 className="text-2xl font-bold">{user.name}</h2>
        <p className="text-gray-500">{user.email}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Major:</span> {user.major}
          </div>
          <div>
            <span className="font-medium">Class of:</span> {user.graduation_year}
          </div>
          <div>
            <span className="font-medium">Karma:</span> {user.karma}
          </div>
        </div>
        {/* TODO: Add "Edit Profile" button/modal for own profile */}
        {/* TODO: Display user's posts list below profile info */}
      </div>
    </div>
  )
}

export default Profile
