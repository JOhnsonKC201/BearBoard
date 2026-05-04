import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import RoleBadge from './RoleBadge'
import { formatRelativeTime } from '../utils/format'

const ROLES = ['student', 'developer', 'moderator', 'admin']

// Display labels for the report-reason slugs returned by the backend.
// Kept in sync with REPORT_REASONS in backend/models/report.py.
const REASON_LABELS = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate: 'Hate',
  misinformation: 'Misinformation',
  inappropriate: 'Inappropriate',
  other: 'Other',
}

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

      <ReportsQueue />

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

/**
 * ReportsQueue — pending-first list of post reports with one-click resolve.
 *
 * Renders inside the Admin Dashboard so the same audience that already has
 * staff-only access sees the queue. Endpoints are mod+admin gated, so a
 * developer-role user who somehow lands on this page sees a 403 surfaced
 * inline rather than a broken UI.
 */
function ReportsQueue() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolving, setResolving] = useState(null) // report id currently being resolved

  const load = () => {
    setLoading(true)
    setError(null)
    apiFetch('/api/admin/reports?status=pending')
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.status === 403) setError('Mods/admins only.')
        else setError(err?.message || 'Failed to load reports')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resolve = async (reportId, status, resolution) => {
    if (resolving) return
    setResolving(reportId)
    try {
      await apiFetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status, resolution }),
      })
      // Drop the row locally — the list is "pending only" so resolved rows
      // shouldn't reappear here.
      setReports((cur) => cur.filter((r) => r.id !== reportId))
    } catch (err) {
      setError(err?.message || 'Could not resolve that report')
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="border-b border-[#EAE7E0]">
      <div className="px-5 py-2 text-[0.6rem] font-archivo font-extrabold uppercase tracking-widest text-gray bg-offwhite flex items-center justify-between">
        <span>
          Reports queue {reports.length > 0 && (
            <span className="ml-2 bg-danger text-white font-archivo font-black text-[0.6rem] px-1.5 py-0.5 rounded-full">
              {reports.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-wide text-navy hover:text-gold bg-transparent border-0 cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading && reports.length === 0 ? (
        <div className="px-5 py-4 text-[0.82rem] text-gray">Loading…</div>
      ) : error ? (
        <div className="px-5 py-4 text-[0.82rem] text-[#8B1A1A] font-archivo font-bold">
          {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="px-5 py-4 text-[0.82rem] text-gray">
          No pending reports — everything's clean.
        </div>
      ) : (
        <ul className="m-0 p-0 list-none">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              busy={resolving === r.id}
              onDismiss={() => resolve(r.id, 'dismissed', 'no_action')}
              onAction={() => resolve(r.id, 'actioned', 'reviewed')}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReportCard({ report, busy, onDismiss, onAction }) {
  const post = report.post
  const reporter = report.reporter
  const reasonLabel = REASON_LABELS[report.reason] || report.reason
  return (
    <li className="px-5 py-3 border-b border-[#EAE7E0] last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider px-2 py-[2px] bg-danger text-white shrink-0 mt-0.5">
          {reasonLabel}
        </span>
        {report.post_report_count > 1 && (
          <span
            className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider px-2 py-[2px] bg-gold-pale text-[#8B6914] border border-gold/40 shrink-0 mt-0.5"
            title={`${report.post_report_count} independent reports against this post`}
          >
            ×{report.post_report_count} reports
          </span>
        )}
        <div className="flex-1 min-w-0">
          {post ? (
            <a
              href={`/post/${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-archivo font-bold text-[0.92rem] text-navy hover:text-gold no-underline truncate"
            >
              {post.title || '(untitled)'}
            </a>
          ) : (
            <span className="font-archivo font-bold text-[0.92rem] text-gray italic">
              (post deleted)
            </span>
          )}
          <div className="text-[0.72rem] text-gray font-franklin mt-0.5">
            Reported by{' '}
            <span className="font-archivo font-extrabold text-ink">
              {reporter?.name || 'unknown'}
            </span>
            {' · '}
            {formatRelativeTime ? formatRelativeTime(report.created_at) : new Date(report.created_at).toLocaleString()}
          </div>
          {report.note && (
            <div className="mt-1.5 text-[0.78rem] text-ink/80 font-franklin leading-snug border-l-2 border-lightgray pl-2.5 italic">
              "{report.note}"
            </div>
          )}
          {post?.body && (
            <div className="mt-1.5 text-[0.74rem] text-gray leading-snug line-clamp-2">
              {post.body}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="bg-navy text-white border-none py-1.5 px-3 font-archivo text-[0.66rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#13284a] transition-colors disabled:opacity-60"
          title="Mark this report as reviewed and acted on (delete the post separately if needed)"
        >
          {busy ? '…' : 'Mark actioned'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="bg-transparent border border-lightgray text-gray hover:text-ink hover:border-gray py-1.5 px-3 font-archivo text-[0.66rem] font-extrabold uppercase tracking-wide cursor-pointer disabled:opacity-60"
        >
          Dismiss
        </button>
        {post && (
          <a
            href={`/post/${post.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[0.66rem] font-archivo font-extrabold uppercase tracking-wide text-navy hover:text-gold no-underline"
          >
            View post →
          </a>
        )}
      </div>
    </li>
  )
}

export default AdminDashboard
