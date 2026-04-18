import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import PostDetail from './pages/PostDetail'
import Stats from './pages/Stats'
import CampusMap from './pages/Map'

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
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<WithNav><Home /></WithNav>} />
          <Route path="/feed" element={<WithNav><Home /></WithNav>} />
          <Route path="/profile/:id" element={<WithNav><Profile /></WithNav>} />
          <Route path="/post/:id" element={<WithNav><PostDetail /></WithNav>} />
          <Route path="/map" element={<WithNav><CampusMap /></WithNav>} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
