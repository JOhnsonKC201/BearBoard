import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="text-center mt-20">
      <h1 className="text-4xl font-bold text-msu-blue mb-4">
        Welcome to BearBoard
      </h1>
      <p className="text-gray-600 mb-8">
        The campus community board for Morgan State University
      </p>

      {/* TODO: This page needs better styling and a real hero section */}
      <div className="flex gap-4 justify-center">
        <Link
          to="/register"
          className="bg-msu-blue text-white px-6 py-2 rounded hover:bg-blue-800"
        >
          Get Started
        </Link>
        <Link
          to="/feed"
          className="border border-msu-blue text-msu-blue px-6 py-2 rounded hover:bg-gray-100"
        >
          Browse Feed
        </Link>
      </div>
    </div>
  )
}

export default Home
