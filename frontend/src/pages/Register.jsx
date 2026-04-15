import { useState } from 'react'

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    major: '',
    graduation_year: '',
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: Connect to POST /api/auth/register
    // TODO: Redirect to login or auto-login after registration
    console.log('Register attempt:', formData)
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-6">Create Account</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="you@morgan.edu"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Major</label>
          <input
            type="text"
            name="major"
            value={formData.major}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Graduation Year</label>
          <input
            type="text"
            name="graduation_year"
            value={formData.graduation_year}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          {/* BUG: graduation_year accepts any text, not validated as a number */}
        </div>
        {/* TODO: Add password confirmation field */}
        {/* TODO: Add form validation (required fields, email format, password length) */}
        <button
          type="submit"
          className="w-full bg-msu-gold text-msu-blue font-bold py-2 rounded hover:bg-yellow-500"
        >
          Register
        </button>
      </form>
    </div>
  )
}

export default Register
