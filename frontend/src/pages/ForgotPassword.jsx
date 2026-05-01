import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { apiFetch, warmBackend } from '../api/client'

const inputClass =
  'w-full border border-lightgray py-3 sm:py-[10px] px-3.5 text-[0.95rem] sm:text-[0.88rem] font-franklin bg-white focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all placeholder:text-gray/60 min-h-[44px]'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Pre-warm Render's free-tier instance on page load so the eventual
  // POST hits a warm process (cold boots otherwise add ~30–60s).
  useEffect(() => { warmBackend() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="Enter your .edu email and we'll send you a link.">
      {sent ? (
        <div className="space-y-4">
          <div className="bg-[#eaf4ea] border border-[#b6d9b6] text-[#2a6e2a] px-3 py-3 text-[0.84rem] font-archivo font-bold">
            Check your inbox — if that email is registered you'll receive a reset link shortly.
          </div>
          <div className="text-center pt-2">
            <Link
              to="/login"
              className="text-navy font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide no-underline hover:text-gold"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@morgan.edu"
              autoComplete="email"
            />
          </div>
          {error && (
            <div
              className="bg-danger-bg border border-danger-border text-danger px-3 py-2.5 text-[0.82rem] font-archivo font-bold flex items-center gap-2"
              role="alert"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3l10 17H2z" />
                <path d="M12 10v4M12 17.5v.5" />
              </svg>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-navy text-white font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide py-3.5 min-h-[48px] border-none cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <span className="status-dot w-1.5 h-1.5 bg-gold rounded-full" />}
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </button>
          <div className="text-center pt-2">
            <Link
              to="/login"
              className="text-gray text-[0.82rem] font-archivo hover:text-navy no-underline"
            >
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}

export default ForgotPassword
