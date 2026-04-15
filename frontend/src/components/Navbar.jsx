import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-msu-blue text-white p-4">
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">
          BearBoard
        </Link>

        {/* TODO: Add search bar */}
        {/* TODO: Add user avatar dropdown (profile, settings, logout) */}
        {/* TODO: Add responsive hamburger menu for mobile */}

        <div className="flex gap-4">
          <Link to="/feed" className="hover:text-msu-gold">Feed</Link>
          <Link to="/login" className="hover:text-msu-gold">Login</Link>
          <Link to="/register" className="hover:text-msu-gold">Register</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
