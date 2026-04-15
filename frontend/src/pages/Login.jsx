import { useState } from 'react'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: Connect to POST /api/auth/login
    // TODO: Store JWT token after successful login
    // TODO: Redirect to feed after login
    console.log('Login attempt:', email)
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-6">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="you@morgan.edu"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
        {/* BUG: No form validation — empty fields can be submitted */}
        <button
          type="submit"
          className="w-full bg-msu-blue text-white py-2 rounded hover:bg-blue-800"
        >
          Login
        </button>
      </form>
    </div>
  )
}

export default Login
