import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

const inputClass =
  'w-full border border-lightgray py-[10px] px-3.5 text-[0.88rem] font-franklin outline-none bg-white focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all placeholder:text-gray/60'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const e = {}
    if (!email.trim()) e.email = 'Email is required'
    if (!password.trim()) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (err) {
      setSubmitError(err.status === 401 ? 'Invalid email or password' : (err.message || 'Login failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in with your .edu account.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@morgan.edu"
            autoComplete="email"
          />
          {errors.email && <p className="text-[#8B1A1A] text-[0.7rem] mt-1 font-archivo font-bold">{errors.email}</p>}
        </div>
        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
          />
          {errors.password && <p className="text-[#8B1A1A] text-[0.7rem] mt-1 font-archivo font-bold">{errors.password}</p>}
        </div>
        {submitError && (
          <div className="bg-[#F5D5D0] border border-[#E5B5B0] text-[#8B1A1A] px-3 py-2 text-[0.78rem] font-archivo font-bold flex items-center gap-2">
            <span aria-hidden="true">&#9888;</span> {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-navy text-white font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 border-none cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <span className="status-dot w-1.5 h-1.5 bg-gold rounded-full" />}
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <div className="text-center mt-5 pt-4 border-t border-[#EAE7E0]">
        <span className="text-gray text-[0.78rem]">Don't have an account? </span>
        <Link to="/register" className="text-navy font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide no-underline hover:text-gold">Register</Link>
      </div>
    </AuthLayout>
  )
}

export default Login
