import { useState } from 'react'
import { Link } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!email.trim()) e.email = 'Email is required'
    if (!password.trim()) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    // TODO: Connect to POST /api/auth/login
    // TODO: Store JWT token after successful login
    // TODO: Redirect to feed after login
    console.log('Login attempt:', email)
  }

  return (
    <div className="min-h-screen bg-offwhite flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <Link to="/" className="font-archivo font-black text-[1.5rem] text-navy no-underline uppercase tracking-tight">
            BEAR<span className="text-gold">BOARD</span>
          </Link>
          <p className="text-gray text-[0.85rem] mt-2">Sign in to your account</p>
        </div>
        <div className="bg-card border border-lightgray p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-lightgray py-[9px] px-3.5 text-[0.85rem] font-franklin outline-none bg-offwhite focus:border-navy focus:bg-white placeholder:text-gray"
                placeholder="you@morgan.edu"
              />
              {errors.email && <p className="text-red text-[0.7rem] mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-lightgray py-[9px] px-3.5 text-[0.85rem] font-franklin outline-none bg-offwhite focus:border-navy focus:bg-white"
              />
              {errors.password && <p className="text-red text-[0.7rem] mt-1">{errors.password}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-navy text-white font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 border-none cursor-pointer hover:bg-[#132d4a] transition-colors"
            >
              Sign In
            </button>
          </form>
          <div className="text-center mt-5 pt-4 border-t border-[#EAE7E0]">
            <span className="text-gray text-[0.78rem]">Don't have an account? </span>
            <Link to="/register" className="text-gold font-semibold text-[0.78rem] no-underline hover:underline">Register</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
