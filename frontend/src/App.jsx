import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Feed from './pages/Feed'
import Profile from './pages/Profile'

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<div className="max-w-5xl mx-auto p-4"><Login /></div>} />
        <Route path="/register" element={<div className="max-w-5xl mx-auto p-4"><Register /></div>} />
        <Route path="/feed" element={<div className="max-w-5xl mx-auto p-4"><Feed /></div>} />
        <Route path="/profile/:id" element={<div className="max-w-5xl mx-auto p-4"><Profile /></div>} />
        {/* TODO: Add /post/:id route for post detail page */}
      </Routes>
    </Router>
  )
}

export default App
