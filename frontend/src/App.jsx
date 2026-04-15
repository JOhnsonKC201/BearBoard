import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'

function WithNav({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<WithNav><Home /></WithNav>} />
        <Route path="/feed" element={<WithNav><Home /></WithNav>} />
        <Route path="/profile/:id" element={<WithNav><Profile /></WithNav>} />
      </Routes>
    </Router>
  )
}

export default App
