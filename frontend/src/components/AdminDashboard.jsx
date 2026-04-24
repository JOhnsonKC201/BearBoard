import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import RoleBadge from './RoleBadge'

const ROLES = ['student', 'developer', 'moderator', 'admin']

function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [assignEmail, setAssignEmail] = useState('')
  const [assignRole, setAssignRole] = useState('moderator')
  const [submitting, setSubmitting] = useState(false)
  const [assignError, setAssignError] = useState(null)
  const [assignSuccess, setAssignSuccess] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    apiFetch('/api/admin/users')
      .then((data) => setUsers(data))
      .catch((err) => setError(err.status === 403 ? 'Admins only.' : (err.message || 'Failed to load users')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const setRole = async (email, role) => {
    setAssignError(null)
    setAssignSuccess(null)
    setSubmitting(true)
    try {
      await apiFetch('/api/admin/set-role', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      })
      setAssignSuccess(`${email} \u2192 ${role}`)
      setAssignEmail('')
      load()
    } catch (err) {
      setAssignError(err.message || 'Failed to update role')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssign = (e) => {
    e.preventDefault()
    if (!assignEmail.trim()) return
    setRole(assignEmail.trim(), assignRole)
  }

  return (
    <div className="bg-card border border-lightgray mb-5">
      <div className="bg-navy px-5 py-3 flex items-center gap-2">
        <span className="font-archivo font-extrabold text-[0.72rem] uppercase tracking-widest text-gold flex items-center gap-2">
          <span aria-hidden="true">&#9881;</span> Admin Dashboard
        </span>
      </div>

      <form onSubmit={handleAssign} className="px-5 py-4 border-b border-[#EAE7E0] grid grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="email"
          value={assignEmail}
          onChange={(e) => setAssignEmail(e.target.value)}
          placeholder="email@morgan.edu"
          disabled={submitting}
          className="border border-lightgray bg-white px-3 py-2 text-[0.85rem] font-franklin focus:border-navy focus:outline-none"
        />
        <select
          value={assignRole}
          onChange={(e) => setAssignRole(e.target.value)}
          disabled={submitting}
          className="border border-lightgray bg-white px-3 py-2 text-[0.82rem] font-archivo font-bold uppercase tracking-wide focus:border-navy focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting || !assignEmail.trim()}
          className="bg-gold text-navy border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Assign
        </button>
        {assignError && (
          <div className="col-span-3 text-[0.78rem] text-[#8B1A1A] font-archivo font-bold">{assignError}</div>
        )}
        {assignSuccess && (
          <div className="col-span-3 text-[0.78rem] text-[#0F5E54] font-archivo font-bold">{assignSuccess}</div>
        )}
      </form>

      <div>
        <div className="px-5 py-2 text-[0.6rem] font-archivo font-extrabold uppercase tracking-widest text-gray border-b border-[#EAE7E0] bg-offwhite">
          All users
        </div>
        {loading ? (
          <div className="px-5 py-4 text-[0.82rem] text-gray">Loading…</div>
        ) : error ? (
          <div className="px-5 py-4 text-[0.82rem] text-[#8B1A1A] font-archivo font-bold">{error}</div>
        ) : users.length === 0 ? (
          <div className="px-5 py-4 text-[0.82rem] text-gray">No users yet.</div>
        ) : users.map((u) => {
          const canRevoke = u.role && u.role !== 'student'
          const revoke = () => {
            if (!confirm(`Revoke ${u.role.toUpperCase()} role from ${u.name}?`)) return
            setRole(u.email, 'student')
          }
          return (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#EAE7E0] last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-[0.85rem] font-semibold truncate">{u.name}</div>
                  <RoleBadge role={u.role} />
                </div>
                <div className="text-[0.7rem] text-gray truncate">{u.email}</div>
              </div>
              <select
                value={u.role}
                onChange={(e) => setRole(u.email, e.target.value)}
                disabled={submitting}
                className="border border-lightgray bg-white px-2 py-1 text-[0.72rem] font-archivo font-bold uppercase tracking-wide focus:border-navy focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {canRevoke && (
                <button
                  type="button"
                  onClick={revoke}
                  disabled={submitting}
                  title={`Revoke ${u.role} role`}
                  className="border border-[#8B1A1A]/30 bg-white text-[#8B1A1A] hover:bg-[#8B1A1A] hover:text-white disabled:opacity-60 disabled:cursor-not-allowed py-1 px-2.5 font-archivo text-[0.65rem] font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AdminDashboard
