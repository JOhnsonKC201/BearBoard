import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { warmBackend } from '../api/client'
import AuthLayout, { AuthFieldsStagger, authFieldChild } from '../components/AuthLayout'

const inputClass =
  'w-full border border-lightgray py-3 sm:py-[10px] px-3.5 text-[0.95rem] sm:text-[0.88rem] font-franklin bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all placeholder:text-gray/60 min-h-[44px] outline-none'

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function FieldError({ message }) {
  return (
    <p
      className={`text-danger text-[0.72rem] font-archivo font-bold overflow-hidden transition-all duration-200 ${
        message ? 'max-h-8 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'
      }`}
    >
      {message || ''}
    </p>
  )
}

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Wake Render's free-tier instance the moment the page loads. By the time
  // the user finishes typing their credentials (5–15s of typing latency on
  // average) the cold boot is done, and the actual /api/auth/login POST hits
  // a warm process. Without this, "Sign in" hangs for 30–60s on a fresh tab.
  useEffect(() => { warmBackend() }, [])

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
      <AuthFieldsStagger>
        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div variants={authFieldChild}>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@morgan.edu"
              autoComplete="email"
            />
            <FieldError message={errors.email} />
          </motion.div>

          <motion.div variants={authFieldChild}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray">Password</label>
              <Link to="/forgot-password" className="text-gray text-[0.72rem] font-archivo hover:text-navy no-underline transition-colors">Forgot password?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray/50 hover:text-navy transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            <FieldError message={errors.password} />
          </motion.div>

          {/* Submit error animates in via AnimatePresence so it slides + fades
              cleanly when validation fails, and out when the user retries. */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                key="submit-error"
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-danger-bg border border-danger-border text-danger px-3 py-2.5 text-[0.82rem] font-archivo font-bold flex items-center gap-2 overflow-hidden"
                role="alert"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3l10 17H2z" />
                  <path d="M12 10v4M12 17.5v.5" />
                </svg>
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={submitting}
            variants={authFieldChild}
            whileHover={submitting ? undefined : { scale: 1.025, boxShadow: '0 12px 28px -10px rgba(11,29,52,0.55)' }}
            whileTap={submitting ? undefined : { scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            className="w-full bg-navy text-white font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide py-3.5 min-h-[48px] border-none cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <motion.span
                  className="w-1.5 h-1.5 bg-gold rounded-full"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <motion.svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  // Arrow nudges right on button hover via the parent's
                  // `group` if we promote it. Easier: keep static here.
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </motion.svg>
              </>
            )}
          </motion.button>
        </form>
      </AuthFieldsStagger>

      <motion.div
        className="text-center mt-5 pt-4 border-t border-divider"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
      >
        <span className="text-gray text-[0.82rem]">Don't have an account? </span>
        <Link to="/register" className="text-navy font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide no-underline hover:text-gold inline-block py-2 min-h-[44px] transition-colors">Register</Link>
      </motion.div>
    </AuthLayout>
  )
}

export default Login
