import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

  const inputClass =
    'w-full border border-lightgray py-[9px] px-3.5 text-[0.85rem] font-franklin outline-none bg-offwhite focus:border-navy focus:bg-white placeholder:text-gray'

  return (
    <div className="min-h-screen bg-offwhite flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <Link to="/" className="font-archivo font-black text-[1.5rem] text-navy no-underline uppercase tracking-tight">
            BEAR<span className="text-gold">BOARD</span>
          </Link>
          <p className="text-gray text-[0.85rem] mt-2">Create your account</p>
        </div>
        <div className="bg-card border border-lightgray p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="Your full name" />
              {errors.name && <p className="text-red text-[0.7rem] mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@morgan.edu" />
              {errors.email && <p className="text-red text-[0.7rem] mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} className={inputClass} />
              {errors.password && <p className="text-red text-[0.7rem] mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Confirm Password</label>
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={inputClass} />
              {errors.confirmPassword && <p className="text-red text-[0.7rem] mt-1">{errors.confirmPassword}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Major</label>
                <input type="text" name="major" value={formData.major} onChange={handleChange} className={inputClass} placeholder="e.g. Computer Science" />
              </div>
              <div>
                <label className="block font-archivo text-[0.7rem] font-bold uppercase tracking-wide text-gray mb-1.5">Grad Year</label>
                <input type="text" name="graduation_year" value={formData.graduation_year} onChange={handleChange} className={inputClass} placeholder="2026" />
                {errors.graduation_year && <p className="text-red text-[0.7rem] mt-1">{errors.graduation_year}</p>}
              </div>
            </div>
            {submitError && (
              <div className="bg-[#F5D5D0] border border-[#E5B5B0] text-[#8B1A1A] px-3 py-2 text-[0.78rem] font-archivo font-bold">
                {submitError}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold text-navy font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 border-none cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <div className="text-center mt-5 pt-4 border-t border-[#EAE7E0]">
            <span className="text-gray text-[0.78rem]">Already have an account? </span>
            <Link to="/login" className="text-gold font-semibold text-[0.78rem] no-underline hover:underline">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
