import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'

// Single page for everything a user might want to do with a group:
// view info, see the member roster, run admin actions, edit settings,
// invite members, manage pending invites + join requests, mute notifications.
// Sections are conditionally rendered by the viewer's role/state so a
// non-member sees only the public surface and a Join button.

export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, isAuthed } = useAuth()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)

  const isAdmin = group?.viewer_role === 'owner' || group?.viewer_role === 'admin'
  const isOwner = group?.viewer_role === 'owner'
  const isMember = !!group?.viewer_role

  const load = useCallback(async () => {
    setError(null)
    try {
      const g = await apiFetch(`/api/groups/${id}`, { cache: false })
      setGroup(g)
      if (g?.viewer_role) {
        const m = await apiFetch(`/api/groups/${id}/members`, { cache: false })
        setMembers(m || [])
      } else {
        setMembers([])
      }
    } catch (e) {
      setError(e?.status === 404 ? 'Group not found' : (e?.message || 'Failed to load group'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const flash = (msg) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3500)
  }

  const join = async () => {
    try {
      await apiFetch(`/api/groups/${id}/join`, { method: 'POST' })
      flash('Joined group')
      load()
    } catch (e) {
      // 202 from approval-required path comes through as a thrown error in
      // our client (non-2xx); the detail message tells the user what
      // happened. Treat as success-ish.
      if (e?.status === 202) {
        flash('Join request submitted — pending admin approval')
        load()
      } else {
        flash(e?.message || 'Failed to join')
      }
    }
  }

  const leave = async () => {
    if (!window.confirm('Leave this group?')) return
    try {
      await apiFetch(`/api/groups/${id}/leave`, { method: 'DELETE' })
      flash('Left group')
      load()
    } catch (e) {
      flash(e?.message || 'Failed to leave')
    }
  }

  const acceptInvite = async () => {
    try {
      await apiFetch(`/api/groups/${id}/invitations/accept`, { method: 'POST' })
      flash('Invitation accepted')
      load()
    } catch (e) { flash(e?.message || 'Failed to accept') }
  }
  const declineInvite = async () => {
    try {
      await apiFetch(`/api/groups/${id}/invitations/decline`, { method: 'POST' })
      flash('Invitation declined')
      load()
    } catch (e) { flash(e?.message || 'Failed to decline') }
  }

  const toggleMute = async () => {
    try {
      const method = group.viewer_muted ? 'DELETE' : 'POST'
      await apiFetch(`/api/groups/${id}/mute`, { method })
      flash(group.viewer_muted ? 'Notifications unmuted' : 'Notifications muted')
      load()
    } catch (e) { flash(e?.message || 'Failed to update mute') }
  }

  const removeMember = async (uid, name) => {
    if (!window.confirm(`Remove ${name} from the group?`)) return
    try {
      await apiFetch(`/api/groups/${id}/members/${uid}`, { method: 'DELETE' })
      flash('Member removed')
      load()
    } catch (e) { flash(e?.message || 'Failed to remove') }
  }
  const promote = async (uid) => {
    try {
      await apiFetch(`/api/groups/${id}/members/${uid}/promote`, { method: 'POST' })
      flash('Promoted to admin')
      load()
    } catch (e) { flash(e?.message || 'Failed to promote') }
  }
  const demote = async (uid) => {
    try {
      await apiFetch(`/api/groups/${id}/members/${uid}/demote`, { method: 'POST' })
      flash('Demoted to member')
      load()
    } catch (e) { flash(e?.message || 'Failed to demote') }
  }
  const transferTo = async (uid, name) => {
    if (!window.confirm(`Transfer ownership to ${name}? You'll become an admin.`)) return
    try {
      await apiFetch(`/api/groups/${id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ new_owner_user_id: uid }),
      })
      flash('Ownership transferred')
      load()
    } catch (e) { flash(e?.message || 'Failed to transfer') }
  }
  const ban = async (uid, name) => {
    if (!window.confirm(`Ban ${name}? They won't be able to rejoin.`)) return
    try {
      await apiFetch(`/api/groups/${id}/members/${uid}/ban`, { method: 'POST' })
      flash('User banned')
      load()
    } catch (e) { flash(e?.message || 'Failed to ban') }
  }
  const deleteGroup = async () => {
    if (!window.confirm('DELETE this group? This cannot be undone.')) return
    try {
      await apiFetch(`/api/groups/${id}`, { method: 'DELETE' })
      navigate('/')
    } catch (e) { flash(e?.message || 'Failed to delete') }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="bg-card border border-lightgray p-6 animate-pulse h-32" />
      </div>
    )
  }
  if (error || !group) {
    return (
      <div className="min-h-[60vh] max-w-[1100px] mx-auto px-4 sm:px-6 py-10 text-center">
        <p className="text-gray font-archivo">{error || 'Group not found'}</p>
        <Link to="/" className="text-gold font-archivo font-extrabold text-mini uppercase tracking-wide">
          Back to feed
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {actionMsg && (
        <div className="bg-navy text-gold px-4 py-2 font-archivo text-mini font-extrabold uppercase tracking-wider" role="status">
          {actionMsg}
        </div>
      )}

      <GroupHeader
        group={group}
        isAuthed={isAuthed}
        isMember={isMember}
        onJoin={join}
        onLeave={leave}
        onAcceptInvite={acceptInvite}
        onDeclineInvite={declineInvite}
        onToggleMute={toggleMute}
      />

      {isMember && (
        <MemberList
          members={members}
          isAdmin={isAdmin}
          isOwner={isOwner}
          currentUserId={currentUser?.id}
          ownerId={members.find((m) => m.role === 'owner')?.user_id}
          onRemove={removeMember}
          onPromote={promote}
          onDemote={demote}
          onTransfer={transferTo}
          onBan={ban}
        />
      )}

      {isAdmin && (
        <>
          <SettingsPanel group={group} onSaved={load} />
          <InviteSection groupId={id} onChanged={load} />
          <JoinRequestQueue groupId={id} onChanged={load} />
        </>
      )}

      {isOwner && (
        <section className="bg-card border border-danger/40 p-4">
          <h3 className="font-archivo font-extrabold text-mini uppercase tracking-wider text-danger mb-2">Danger zone</h3>
          <p className="text-[0.82rem] text-gray mb-3">
            Deleting the group is permanent. Members, invitations, and join requests will be removed.
          </p>
          <button
            onClick={deleteGroup}
            className="bg-danger text-white border-none py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-90"
          >
            Delete group
          </button>
        </section>
      )}
    </div>
  )
}

function GroupHeader({ group, isAuthed, isMember, onJoin, onLeave, onAcceptInvite, onDeclineInvite, onToggleMute }) {
  return (
    <header className="bg-card border border-lightgray p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="font-editorial font-black text-[1.6rem] sm:text-[1.85rem] tracking-tight leading-none m-0">
              {group.name}
            </h1>
            {group.is_private && (
              <Tag>Private</Tag>
            )}
            {group.requires_approval && !group.is_private && (
              <Tag>Approval required</Tag>
            )}
          </div>
          <div className="text-[0.78rem] text-gray font-archivo uppercase tracking-wider mb-2">
            {group.course_code ? `${group.course_code} · ` : ''}{group.member_count} member{group.member_count === 1 ? '' : 's'}
          </div>
          {group.description && (
            <p className="text-[0.92rem] text-ink/85 font-franklin leading-relaxed max-w-[60ch] m-0">
              {group.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isAuthed && (
            <Link to="/login" className="bg-navy text-gold no-underline py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider hover:bg-[#132d4a]">
              Log in to join
            </Link>
          )}
          {isAuthed && group.has_pending_invite && !isMember && (
            <>
              <button onClick={onAcceptInvite} className="bg-gold text-navy border-none py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#E5A92E]">
                Accept invite
              </button>
              <button onClick={onDeclineInvite} className="bg-transparent border border-lightgray py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer text-gray hover:text-ink">
                Decline
              </button>
            </>
          )}
          {isAuthed && !isMember && !group.has_pending_invite && (
            <>
              {group.has_pending_request ? (
                <span className="text-[0.82rem] text-gray font-archivo uppercase tracking-wider">Request pending</span>
              ) : (
                <button onClick={onJoin} className="bg-navy text-gold border-none py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a]">
                  {group.is_private ? 'Request invite' : group.requires_approval ? 'Request to join' : 'Join group'}
                </button>
              )}
            </>
          )}
          {isAuthed && isMember && (
            <>
              <button onClick={onToggleMute} className="bg-transparent border border-lightgray py-2 px-3 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer text-gray hover:text-ink">
                {group.viewer_muted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={onLeave} className="bg-transparent border border-danger/60 text-danger py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-danger hover:text-white">
                Leave
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Tag({ children }) {
  return (
    <span className="text-2xs font-archivo font-extrabold uppercase tracking-wider bg-offwhite border border-lightgray px-2 py-0.5">
      {children}
    </span>
  )
}

function MemberList({ members, isAdmin, isOwner, currentUserId, ownerId, onRemove, onPromote, onDemote, onTransfer, onBan }) {
  return (
    <section className="bg-card border border-lightgray p-5">
      <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-3">Members</h2>
      <ul className="list-none p-0 m-0 divide-y divide-lightgray">
        {members.map((m) => {
          const isSelf = m.user_id === currentUserId
          const isTargetOwner = m.role === 'owner'
          const isTargetAdmin = m.role === 'admin'
          // Admins (non-owner) can act on members but not on other admins or the owner.
          const canAct = isAdmin && !isSelf && !isTargetOwner
          const canActOnAdmin = isOwner
          return (
            <li key={m.user_id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Link to={`/profile/${m.user_id}`} className="text-ink no-underline hover:underline font-franklin truncate">
                  {m.name}
                </Link>
                <RoleBadge role={m.role} />
                {m.invited_by_name && (
                  <span className="text-2xs text-gray font-archivo uppercase tracking-wider">
                    invited by {m.invited_by_name}
                  </span>
                )}
              </div>
              {canAct && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(!isTargetAdmin || canActOnAdmin) && (
                    <>
                      {isOwner && !isTargetAdmin && (
                        <ActionBtn onClick={() => onPromote(m.user_id)}>Make admin</ActionBtn>
                      )}
                      {isOwner && isTargetAdmin && (
                        <ActionBtn onClick={() => onDemote(m.user_id)}>Demote</ActionBtn>
                      )}
                      {isOwner && (
                        <ActionBtn onClick={() => onTransfer(m.user_id, m.name)}>Transfer ownership</ActionBtn>
                      )}
                      <ActionBtn onClick={() => onRemove(m.user_id, m.name)}>Remove</ActionBtn>
                      <ActionBtn danger onClick={() => onBan(m.user_id, m.name)}>Ban</ActionBtn>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RoleBadge({ role }) {
  if (role === 'owner') return <Tag>Owner</Tag>
  if (role === 'admin') return <Tag>Admin</Tag>
  return null
}

function ActionBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`text-2xs font-archivo font-extrabold uppercase tracking-wider px-2 py-1 border cursor-pointer ${
        danger
          ? 'border-danger/60 text-danger hover:bg-danger hover:text-white'
          : 'border-lightgray text-gray hover:text-ink hover:border-navy'
      }`}
    >
      {children}
    </button>
  )
}

function SettingsPanel({ group, onSaved }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(group.name || '')
  const [description, setDescription] = useState(group.description || '')
  const [courseCode, setCourseCode] = useState(group.course_code || '')
  const [isPrivate, setIsPrivate] = useState(!!group.is_private)
  const [requiresApproval, setRequiresApproval] = useState(!!group.requires_approval)
  const [posting, setPosting] = useState(group.posting_permission || 'all')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await apiFetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          course_code: courseCode.trim(),
          is_private: isPrivate,
          requires_approval: requiresApproval,
          posting_permission: posting,
        }),
      })
      setOpen(false)
      onSaved?.()
    } catch (e2) {
      setErr(e2?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-card border border-lightgray p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider m-0">Settings</h2>
        <button onClick={() => setOpen((o) => !o)} className="text-mini font-archivo font-extrabold uppercase tracking-wider text-gray hover:text-ink cursor-pointer bg-transparent border-none">
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      {open && (
        <form onSubmit={save} className="space-y-3">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none" />
          </Field>
          <Field label="Course code (optional)">
            <input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="COSC 350" className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin resize-y focus:border-navy focus:outline-none" />
          </Field>
          <label className="flex items-start gap-2 text-[0.82rem] font-franklin cursor-pointer">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-1 accent-navy" />
            <span>
              <strong>Private group</strong> — hidden from the browse list. Members join by invitation only.
            </span>
          </label>
          <label className="flex items-start gap-2 text-[0.82rem] font-franklin cursor-pointer">
            <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} className="mt-1 accent-navy" disabled={isPrivate} />
            <span>
              <strong>Approval required</strong> — public-group joins go through admin review. (Always on for private groups.)
            </span>
          </label>
          <Field label="Who can post">
            <select value={posting} onChange={(e) => setPosting(e.target.value)} className="border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none">
              <option value="all">All members</option>
              <option value="admins">Admins only</option>
            </select>
          </Field>
          {err && <div className="text-mini text-danger font-archivo font-bold">{err}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-navy text-gold border-none py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a] disabled:opacity-60">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="bg-transparent border border-lightgray py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider text-gray hover:text-ink cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function InviteSection({ groupId, onChanged }) {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [pending, setPending] = useState([])

  const loadPending = useCallback(async () => {
    try {
      const rows = await apiFetch(`/api/groups/${groupId}/invitations`, { cache: false })
      setPending(rows || [])
    } catch { setPending([]) }
  }, [groupId])
  useEffect(() => { loadPending() }, [loadPending])

  const send = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await apiFetch(`/api/groups/${groupId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      })
      setUsername('')
      loadPending()
      onChanged?.()
    } catch (e2) {
      setErr(e2?.message || 'Failed to invite')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (invId) => {
    try {
      await apiFetch(`/api/groups/${groupId}/invitations/${invId}`, { method: 'DELETE' })
      loadPending()
    } catch (e) { setErr(e?.message || 'Failed to revoke') }
  }

  return (
    <section className="bg-card border border-lightgray p-5">
      <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-2">Invitations</h2>
      <form onSubmit={send} className="flex gap-2 flex-wrap mb-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Invite by username"
          className="flex-1 min-w-[180px] border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none"
        />
        <button type="submit" disabled={busy || !username.trim()} className="bg-navy text-gold border-none py-2 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a] disabled:opacity-60">
          {busy ? 'Sending…' : 'Invite'}
        </button>
      </form>
      {err && <div className="text-mini text-danger font-archivo font-bold mb-2">{err}</div>}
      {pending.length === 0 ? (
        <div className="text-[0.82rem] text-gray font-archivo">No pending invitations.</div>
      ) : (
        <ul className="list-none p-0 m-0 divide-y divide-lightgray">
          {pending.map((inv) => (
            <li key={inv.id} className="py-2 flex items-center justify-between gap-2">
              <span className="text-[0.88rem] font-franklin">
                {inv.invited_user_name || `User #${inv.invited_user_id}`}
                <span className="text-2xs text-gray font-archivo uppercase tracking-wider ml-2">pending</span>
              </span>
              <ActionBtn onClick={() => revoke(inv.id)}>Revoke</ActionBtn>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function JoinRequestQueue({ groupId, onChanged }) {
  const [requests, setRequests] = useState([])
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    try {
      const rows = await apiFetch(`/api/groups/${groupId}/requests`, { cache: false })
      setRequests(rows || [])
    } catch { setRequests([]) }
  }, [groupId])
  useEffect(() => { load() }, [load])

  const approve = async (uid) => {
    try {
      await apiFetch(`/api/groups/${groupId}/requests/${uid}/approve`, { method: 'POST' })
      load(); onChanged?.()
    } catch (e) { setErr(e?.message || 'Failed') }
  }
  const deny = async (uid) => {
    try {
      await apiFetch(`/api/groups/${groupId}/requests/${uid}/deny`, { method: 'POST' })
      load()
    } catch (e) { setErr(e?.message || 'Failed') }
  }

  if (requests.length === 0) return null

  return (
    <section className="bg-card border border-lightgray p-5">
      <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-2">
        Pending join requests ({requests.length})
      </h2>
      {err && <div className="text-mini text-danger font-archivo font-bold mb-2">{err}</div>}
      <ul className="list-none p-0 m-0 divide-y divide-lightgray">
        {requests.map((r) => (
          <li key={r.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[0.88rem] font-franklin">
              {r.user_name || `User #${r.user_id}`}
            </span>
            <div className="flex gap-1.5">
              <ActionBtn onClick={() => approve(r.user_id)}>Approve</ActionBtn>
              <ActionBtn onClick={() => deny(r.user_id)}>Deny</ActionBtn>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-wide text-gray block mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}
