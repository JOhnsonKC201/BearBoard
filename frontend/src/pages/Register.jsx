import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

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

function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    major: '',
    graduation_year: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const validate = () => {
    const e = {}
    if (!formData.name.trim()) e.name = 'Name is required'
    if (!formData.email.trim()) e.email = 'Email is required'
    else if (!/^[^@\s]+@[^@\s]+\.edu$/i.test(formData.email.trim())) {
      e.email = 'Use your .edu email (e.g. you@morgan.edu)'
    }
    if (!formData.password) e.password = 'Password is required'
    else if (formData.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (formData.graduation_year) {
      const year = parseInt(formData.graduation_year, 10)
      const currentYear = new Date().getFullYear()
      if (isNaN(year) || year < currentYear || year > currentYear + 6) {
        e.graduation_year = `Enter a valid year (${currentYear}–${currentYear + 6})`
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        name: formData.name.trim(),
        major: formData.major.trim() || null,
        graduation_year: formData.graduation_year ? parseInt(formData.graduation_year, 10) : null,
      }
      await register(payload)
      navigate('/welcome')
    } catch (err) {
      setSubmitError(err.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="BearBoard is for students only. Sign up with your .edu email.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Full Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="Your full name" />
          <FieldError message={errors.name} />
        </div>

        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@morgan.edu" autoComplete="email" />
          <FieldError message={errors.email} />
        </div>

        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`${inputClass} pr-10`}
              autoComplete="new-password"
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
        </div>

        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`${inputClass} pr-10`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray/50 hover:text-navy transition-colors"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          <FieldError message={errors.confirmPassword} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Major</label>
            <input type="text" name="major" value={formData.major} onChange={handleChange} className={inputClass} placeholder="e.g. CS" />
          </div>
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Grad Year</label>
            <input type="text" name="graduation_year" value={formData.graduation_year} onChange={handleChange} className={inputClass} placeholder="2026" />
            <FieldError message={errors.graduation_year} />
          </div>
        </div>

        {submitError && (
          <div className="bg-danger-bg border border-danger-border text-danger px-3 py-2.5 text-[0.82rem] font-archivo font-bold flex items-center gap-2" role="alert">
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
          className="w-full bg-gold text-navy font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide py-3.5 min-h-[48px] border-none cursor-pointer hover:bg-[#E5A92E] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-1.5 h-1.5 bg-navy rounded-full animate-pulse" />
              Creating account...
            </>
          ) : (
            <>
              Create Account
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-5 pt-4 border-t border-divider">
        <span className="text-gray text-[0.82rem]">Already have an account? </span>
        <Link to="/login" className="text-navy font-archivo font-extrabold text-[0.82rem] uppercase tracking-wide no-underline hover:text-gold inline-block py-2 min-h-[44px] transition-colors">Sign In</Link>
      </div>
    </AuthLayout>
  )
}

export default Register
