import { useState } from 'react'
import { Link } from 'react-router-dom'

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    major: '',
    graduation_year: '',
  })
  const [errors, setErrors] = useState({})

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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    // TODO: Connect to POST /api/auth/register
    // TODO: Auto-login and redirect to feed after registration
    console.log('Register attempt:', formData)
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
            <button
              type="submit"
              className="w-full bg-gold text-navy font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 border-none cursor-pointer hover:bg-[#E5A92E] transition-colors"
            >
              Create Account
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
