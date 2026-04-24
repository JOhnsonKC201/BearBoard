import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Lazy-load rarely-visited pages so they aren't in the initial bundle.
// Home, Login, Register stay eagerly loaded because those are the most
// common landing routes.
const Profile = lazy(() => import('./pages/Profile'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const Stats = lazy(() => import('./pages/Stats'))
const CampusMap = lazy(() => import('./pages/Map'))
const Professors = lazy(() => import('./pages/Professors'))
const Legal = lazy(() => import('./pages/Legal'))
const Resources = lazy(() => import('./pages/Resources'))
const Crosslinks = lazy(() => import('./pages/Crosslinks'))
const Welcome = lazy(() => import('./pages/Welcome'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))

function WithNav({ children }) {
  return (
    <>
      <Navbar />
      <div className="pb-[72px] lg:pb-0 min-h-[60vh] flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
      <BottomNav />
    </>
  )
}

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-gray text-[0.82rem] font-archivo">
      Loading...
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<WithNav><Home /></WithNav>} />
            <Route path="/feed" element={<WithNav><Home /></WithNav>} />
            <Route path="/profile/:id" element={<WithNav><Profile /></WithNav>} />
            <Route path="/post/:id" element={<WithNav><PostDetail /></WithNav>} />
            <Route path="/map" element={<WithNav><CampusMap /></WithNav>} />
            <Route path="/professors" element={<WithNav><Professors /></WithNav>} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/resources" element={<WithNav><Resources /></WithNav>} />
            <Route path="/rules" element={<WithNav><Legal slug="rules" /></WithNav>} />
            <Route path="/privacy" element={<WithNav><Legal slug="privacy" /></WithNav>} />
            <Route path="/terms" element={<WithNav><Legal slug="terms" /></WithNav>} />
            <Route path="/accessibility" element={<WithNav><Legal slug="accessibility" /></WithNav>} />
            <Route path="/anonymity" element={<WithNav><Legal slug="anonymity" /></WithNav>} />
            <Route path="/crosslinks" element={<WithNav><Crosslinks /></WithNav>} />
            <Route path="/welcome" element={<WithNav><Welcome /></WithNav>} />
            <Route path="/leaderboard" element={<WithNav><Leaderboard /></WithNav>} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  )
}

export default App
