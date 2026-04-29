import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'

const CreateGroupModal = lazy(() => import('../components/CreateGroupModal'))

// Full groups directory. Lists every public group (private ones are hidden
// by the API), supports search by course code or name, and surfaces
// pending invitations to the current user up top so they can accept/
// decline without hunting for them.

export default function Groups() {
  const { user, isAuthed } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [myGroupIds, setMyGroupIds] = useState(new Set())
  const [pendingInvites, setPendingInvites] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const list = await apiFetch('/api/groups', { cache: false })
      setGroups(list || [])
      if (isAuthed) {
        const ids = await apiFetch('/api/groups/mine', { cache: false }).catch(() => [])
        setMyGroupIds(new Set(ids || []))
        const invs = await apiFetch('/api/groups/me/invitations', { cache: false }).catch(() => [])
        setPendingInvites(invs || [])
      } else {
        setMyGroupIds(new Set())
        setPendingInvites([])
      }
    } catch (e) {
      setError(e?.message || 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [isAuthed])

  useEffect(() => { load() }, [load])

  // Debounced server-side search by course or name. Resets to the default
  // list when the input is empty.
  useEffect(() => {
    const q = search.trim()
    const handle = setTimeout(async () => {
      try {
        const url = q ? `/api/groups?course=${encodeURIComponent(q)}` : '/api/groups'
        const list = await apiFetch(url, { cache: false })
        setGroups(list || [])
      } catch { /* keep prior list */ }
    }, 250)
    return () => clearTimeout(handle)
  }, [search])

  const toggleMembership = async (groupId, joined) => {
    if (!isAuthed) { navigate('/login'); return }
    setBusy(groupId)
    setMyGroupIds((prev) => {
      const next = new Set(prev)
      if (joined) next.delete(groupId); else next.add(groupId)
      return next
    })
    try {
      if (joined) {
        await apiFetch(`/api/groups/${groupId}/leave`, { method: 'DELETE' })
      } else {
        await apiFetch(`/api/groups/${groupId}/join`, { method: 'POST' })
      }
      load()
    } catch (e) {
      // Roll back on failure (e.g. private group: 403, approval-required: 202).
      setMyGroupIds((prev) => {
        const next = new Set(prev)
        if (joined) next.add(groupId); else next.delete(groupId)
        return next
      })
    } finally {
      setBusy(null)
    }
  }

  const handleCreate = async ({ name, course_code, description }) => {
    const created = await apiFetch('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, course_code, description }),
    })
    setGroups((prev) => [created, ...prev])
    setMyGroupIds((prev) => new Set(prev).add(created.id))
    setShowCreate(false)
  }

  const empty = !loading && groups.length === 0

  return (
    <div className="min-h-[60vh] max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-editorial font-black text-[2rem] sm:text-[2.4rem] leading-none tracking-tight m-0">
            Groups
          </h1>
          <p className="text-mini text-gray font-archivo uppercase tracking-wider mt-2">
            Study groups, course threads, and crews. {groups.length} listed.
          </p>
        </div>
        {isAuthed && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-gold text-navy border-none py-2.5 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#E5A92E]"
          >
            + Create group
          </button>
        )}
      </header>

      {pendingInvites.length > 0 && (
        <section className="bg-card border border-gold/40 border-l-[3px] border-l-gold p-4">
          <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-2">
            Your pending invitations ({pendingInvites.length})
          </h2>
          <ul className="list-none p-0 m-0 divide-y divide-lightgray">
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[0.88rem] font-franklin">
                  <Link to={`/groups/${inv.group_id}`} className="text-ink no-underline hover:underline font-semibold">
                    {inv.group_name}
                  </Link>
                  <span className="text-gray text-2xs font-archivo uppercase tracking-wider ml-2">
                    invited by {inv.invited_by_name || 'an admin'}
                  </span>
                </div>
                <Link
                  to={`/groups/${inv.group_id}`}
                  className="text-2xs font-archivo font-extrabold uppercase tracking-wider px-3 py-1.5 border border-navy text-navy hover:bg-navy hover:text-gold no-underline transition-colors"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by course code or name (e.g. COSC 350)…"
        className="w-full border border-lightgray bg-white px-4 py-2.5 text-[0.95rem] font-franklin focus:border-navy focus:outline-none"
      />

      {loading && (
        <div className="space-y-2">
          {[1,2,3].map((i) => (
            <div key={i} className="bg-card border border-lightgray h-[88px] animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-danger-bg border border-danger/40 text-danger px-4 py-3 font-archivo text-mini font-bold">
          {error}
        </div>
      )}

      {!loading && empty && (
        <div className="bg-card border border-dashed border-lightgray px-5 py-10 text-center">
          <div className="font-editorial italic text-[1.2rem] text-gray leading-snug mb-1">
            “Nothing here yet.”
          </div>
          <p className="text-mini text-gray font-archivo uppercase tracking-wider mb-3">
            {search.trim() ? `No matches for "${search.trim()}".` : 'Be the first to start a group.'}
          </p>
          {isAuthed && (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-navy text-gold border-none py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a]"
            >
              Create group
            </button>
          )}
        </div>
      )}

      {!loading && !empty && (
        <ul className="list-none p-0 m-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((g) => {
            const joined = myGroupIds.has(g.id)
            return (
              <li key={g.id} className="bg-card border border-lightgray hover:border-navy/30 transition-colors p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {g.course_code && (
                      <span className="text-2xs font-archivo font-extrabold uppercase tracking-wider bg-offwhite border border-lightgray px-2 py-[2px]">
                        {g.course_code}
                      </span>
                    )}
                    <Link to={`/groups/${g.id}`} className="text-ink no-underline hover:underline">
                      <span className="font-archivo font-bold text-[0.95rem]">{g.name}</span>
                    </Link>
                  </div>
                  {g.description && (
                    <p className="text-[0.84rem] text-ink/75 font-prose leading-relaxed line-clamp-2 mb-1.5 m-0">
                      {g.description}
                    </p>
                  )}
                  <div className="text-2xs text-gray font-archivo uppercase tracking-wider">
                    {g.member_count} member{g.member_count === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  onClick={() => toggleMembership(g.id, joined)}
                  disabled={busy === g.id}
                  className={`shrink-0 font-archivo text-2xs font-extrabold uppercase tracking-wider py-1.5 px-3 border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait ${
                    joined
                      ? 'bg-transparent border-lightgray text-gray hover:border-danger hover:text-danger'
                      : 'bg-gold border-gold text-navy hover:bg-[#E5A92E]'
                  }`}
                >
                  {busy === g.id ? '…' : joined ? 'Leave' : 'Join'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {showCreate && (
        <Suspense fallback={null}>
          <CreateGroupModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        </Suspense>
      )}
    </div>
  )
}
