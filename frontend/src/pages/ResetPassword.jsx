import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { apiFetch } from '../api/client'

const inputClass =
  'w-full border border-lightgray py-3 sm:py-[10px] px-3.5 text-[0.95rem] sm:text-[0.88rem] font-franklin bg-white focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all placeholder:text-gray/60 min-h-[44px]'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const validate = () => {
    const e = {}
    if (password.length < 6) e.password = 'Password must be at least 6 characters'
    if (password !== confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    if (!token) {
      setSubmitError('Missing reset token. Please use the link from your email.')
      return
    }
    if (!validate()) return
    setSubmitting(true)
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setSubmitError(err.message || 'This link is invalid or has expired.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This password reset link is missing a token.">
        <div className="text-center">
          <Link
            to="/forgot-password"
            className="text-navy font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide no-underline hover:text-gold"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a new password for your account.">
      {done ? (
        <div className="space-y-4">
          <div className="bg-[#eaf4ea] border border-[#b6d9b6] text-[#2a6e2a] px-3 py-3 text-[0.84rem] font-archivo font-bold">
            Password updated! Redirecting you to sign in…
          </div>
          <div className="text-center pt-2">
            <Link
              to="/login"
              className="text-navy font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide no-underline hover:text-gold"
            >
              Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="text-danger text-[0.72rem] mt-1 font-archivo font-bold">{errors.password}</p>
            )}
          </div>
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
            {errors.confirm && (
              <p className="text-danger text-[0.72rem] mt-1 font-archivo font-bold">{errors.confirm}</p>
            )}
          </div>
          {submitError && (
            <div
              className="bg-danger-bg border border-danger-border text-danger px-3 py-2.5 text-[0.82rem] font-archivo font-bold flex items-center gap-2"
              role="alert"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3l10 17H2z" />
                <path d="M12 10v4M12 17.5v.5" />
              </svg>
              {submitError}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-navy text-white font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide py-3.5 min-h-[48px] border-none cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <span className="status-dot w-1.5 h-1.5 bg-gold rounded-full" />}
            {submitting ? 'Saving...' : 'Set New Password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

export default ResetPassword
