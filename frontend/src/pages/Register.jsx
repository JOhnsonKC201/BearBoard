import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

const inputClass =
  'w-full border border-lightgray py-[10px] px-3.5 text-[0.88rem] font-franklin outline-none bg-white focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all placeholder:text-gray/60'

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
      if (isNaN(year) || year < 2024 || year > 2030) e.graduation_year = 'Enter a valid year (2024-2030)'
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
      navigate('/')
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
          {errors.name && <p className="text-[#8B1A1A] text-[0.7rem] mt-1 font-archivo font-bold">{errors.name}</p>}
        </div>
        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@morgan.edu" autoComplete="email" />
          {errors.email && <p className="text-[#8B1A1A] text-[0.7rem] mt-1 font-archivo font-bold">{errors.email}</p>}
        </div>
        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Password</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} className={inputClass} autoComplete="new-password" />
          {errors.password && <p className="text-[#8B1A1A] text-[0.7rem] mt-1 font-archivo font-bold">{errors.password}</p>}
        </div>
        <div>
          <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Confirm Password</label>
          <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={inputClass} autoComplete="new-password" />
          {errors.confirmPassword && <p className="text-[#8B1A1A] text-[0.7rem] mt-1 font-archivo font-bold">{errors.confirmPassword}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Major</label>
            <input type="text" name="major" value={formData.major} onChange={handleChange} className={inputClass} placeholder="e.g. CS" />
          </div>
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Grad Year</label>
            <input type="text" name="graduation_year" value={formData.graduation_year} onChange={handleChange} className={inputClass} placeholder="2026" />
            {errors.graduation_year && <p className="text-[#8B1A1A] text-[0.7rem] mt-1 font-archivo font-bold">{errors.graduation_year}</p>}
          </div>
        </div>
        {submitError && (
          <div className="bg-[#F5D5D0] border border-[#E5B5B0] text-[#8B1A1A] px-3 py-2 text-[0.78rem] font-archivo font-bold flex items-center gap-2">
            <span aria-hidden="true">&#9888;</span> {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gold text-navy font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 border-none cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <span className="status-dot w-1.5 h-1.5 bg-navy rounded-full" />}
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
      <div className="text-center mt-5 pt-4 border-t border-[#EAE7E0]">
        <span className="text-gray text-[0.78rem]">Already have an account? </span>
        <Link to="/login" className="text-navy font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide no-underline hover:text-gold">Sign In</Link>
      </div>
    </AuthLayout>
  )
}

export default Register
