import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { parseUtcDate } from '../utils/format'

// Group chat — Phase 1.
//
// Reuses the existing chat WebSocket (`/api/chat/ws?token=...`) by listening
// for the new `group_message` and `group_message_updated` frame types and
// sending `group_send` / `group_edit` frames back. Initial history comes
// from the REST endpoint added in routers/group_chat.py.
//
// Membership-gated: the parent `GroupDetail` only renders this panel when
// `isMember` is true, so we don't have to re-check here.
//
// Edit support is owner-only with a 15-minute window — same contract the
// 1-on-1 chat already has. The server enforces it; the client mirrors the
// window to gate the Edit affordance so we don't render a button for a
// message we know the server will reject.

const EDIT_WINDOW_MS = 15 * 60 * 1000

function fmtTime(iso) {
  if (!iso) return ''
  const d = parseUtcDate(iso)
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function withinEditWindow(iso) {
  if (!iso) return false
  const d = parseUtcDate(iso)
  const t = d ? d.getTime() : NaN
  if (Number.isNaN(t)) return false
  return Date.now() - t < EDIT_WINDOW_MS
}

function GroupChatPanel({ groupId }) {
  const { user, token } = useAuth()
  const meId = user?.id
  const [messages, setMessages] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const scrollerRef = useRef(null)
  const errorTimerRef = useRef(null)

  // Initial load. Refetched whenever groupId changes (rare in practice
  // since we live inside GroupDetail) so a navigation between groups
  // resets the history view.
  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    apiFetch(`/api/groups/${groupId}/messages?limit=50`, { cache: false })
      .then((data) => {
        if (cancelled) return
        setMessages(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (cancelled) return
        setHistoryError(err?.message || 'Could not load chat history')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => { cancelled = true }
  }, [groupId])

  // Live message arrives → append (or merge if dupe). The server echoes
  // the sender's own message back through this same path so we don't need
  // a separate optimistic-then-replace flow.
  const handleGroupMessage = useCallback((frame) => {
    if (frame.group_id !== groupId) return
    setMessages((prev) => {
      if (prev.some((m) => m.id === frame.id)) return prev
      return [...prev, frame]
    })
  }, [groupId])

  // A message was edited (by us or someone else) — patch in place.
  const handleGroupMessageUpdated = useCallback((frame) => {
    if (frame.group_id !== groupId) return
    setMessages((prev) => prev.map((m) => (
      m.id === frame.id ? { ...m, body: frame.body, edited_at: frame.edited_at } : m
    )))
  }, [groupId])

  const handleError = useCallback((frame) => {
    const detail = frame?.detail || frame?.code || 'Something went wrong.'
    setErrorMsg(String(detail))
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 4000)
  }, [])

  const { send, status } = useChatSocket({
    token,
    onGroupMessage: handleGroupMessage,
    onGroupMessageUpdated: handleGroupMessageUpdated,
    onError: handleError,
  })

  // Auto-scroll to bottom on new messages. Only fires when the user is
  // already near the bottom — preserves their position if they scrolled
  // up to read older messages.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  const submit = (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setErrorMsg(null)
    const ok = send({ type: 'group_send', group_id: groupId, body })
    if (!ok) {
      // Socket isn't open — fall back to the REST endpoint so the message
      // still goes through. The server will broadcast to other members.
      apiFetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
        .then((msg) => {
          // Echo into our own list since the WS isn't there to do it for us.
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
          setDraft('')
        })
        .catch((err) => setErrorMsg(err?.message || 'Send failed'))
        .finally(() => setSending(false))
    } else {
      setDraft('')
      setSending(false)
    }
  }

  const beginEdit = (msg) => {
    setEditingId(msg.id)
    setEditDraft(msg.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const submitEdit = () => {
    const next = editDraft.trim()
    if (!next || !editingId) return
    const target = messages.find((m) => m.id === editingId)
    if (target && next === target.body) {
      cancelEdit()
      return
    }
    const ok = send({ type: 'group_edit', message_id: editingId, body: next })
    if (!ok) {
      // REST fallback if the socket is mid-reconnect.
      apiFetch(`/api/groups/${groupId}/messages/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: next }),
      })
        .then((msg) => {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
          cancelEdit()
        })
        .catch((err) => setErrorMsg(err?.message || 'Edit failed'))
    } else {
      // Optimistic close. The server's `group_message_updated` frame will
      // overwrite the body shortly with the canonical version.
      cancelEdit()
    }
  }

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const ta = parseUtcDate(a.created_at)?.getTime() || 0
      const tb = parseUtcDate(b.created_at)?.getTime() || 0
      return ta - tb
    })
  }, [messages])

  return (
    <section className="bg-card border border-lightgray flex flex-col" aria-label="Group chat">
      <header className="px-5 py-3 border-b border-lightgray flex items-center justify-between">
        <h2 className="font-archivo font-extrabold text-mini uppercase tracking-wider m-0">
          Group chat
        </h2>
        {status !== 'open' && (
          <span className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.1em] px-2 py-1 border bg-gold/15 text-gold border-gold/30">
            {status === 'reconnecting' ? 'Reconnecting' : status === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
        )}
      </header>

      <div ref={scrollerRef} className="px-5 py-4 max-h-[480px] min-h-[260px] overflow-y-auto bg-offwhite flex flex-col gap-3">
        {historyLoading && (
          <div className="text-center text-gray text-[0.82rem] py-6">Loading messages…</div>
        )}
        {historyError && (
          <div className="text-center text-danger text-[0.82rem] py-6 font-archivo font-bold">{historyError}</div>
        )}
        {!historyLoading && !historyError && sortedMessages.length === 0 && (
          <div className="text-center text-gray text-[0.82rem] py-6 font-prose italic">
            No messages yet. Be the first to say something.
          </div>
        )}
        {sortedMessages.map((m) => {
          const mine = m.author_id === meId
          const canEdit = mine && withinEditWindow(m.created_at)
          const editing = editingId === m.id
          const authorName = m.author?.name || (mine ? 'You' : 'Member')
          return (
            <div key={m.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.1em] text-gray/70 px-1 mb-1">
                {authorName}
              </div>
              <div className="flex items-end gap-1.5 max-w-full">
                <div className={`px-4 py-2 max-w-[78%] font-franklin text-[0.92rem] leading-[1.45] whitespace-pre-wrap break-words rounded-2xl ${
                  mine ? 'bg-navy text-white rounded-br-md' : 'bg-white text-ink border border-lightgray rounded-bl-md'
                }`}>
                  {editing ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            submitEdit()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelEdit()
                          }
                        }}
                        rows={2}
                        maxLength={4000}
                        className="resize-none rounded-md bg-white/10 text-inherit px-2 py-1 font-franklin text-[0.92rem] leading-snug focus:outline-none focus:ring-2 focus:ring-gold/40"
                        autoFocus
                      />
                      <div className="flex gap-2 text-[0.7rem] font-archivo font-extrabold uppercase tracking-[0.08em]">
                        <button type="button" onClick={submitEdit} className="bg-gold text-navy px-2.5 py-1 rounded-md cursor-pointer border-0 hover:opacity-90">Save</button>
                        <button type="button" onClick={cancelEdit} className="bg-transparent text-current/80 px-2.5 py-1 rounded-md cursor-pointer border border-current/30 hover:border-current/60">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    m.body
                  )}
                </div>
                {canEdit && !editing && (
                  <button
                    type="button"
                    onClick={() => beginEdit(m)}
                    title="Edit message"
                    aria-label="Edit message"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[0.7rem] font-archivo font-extrabold uppercase tracking-[0.08em] text-gray/70 hover:text-navy bg-transparent border-0 cursor-pointer px-1.5 py-1"
                  >
                    Edit
                  </button>
                )}
              </div>
              <span className="text-[0.62rem] font-archivo uppercase tracking-[0.08em] text-gray/60 px-1 mt-1 flex items-center gap-1.5">
                <span>{fmtTime(m.created_at)}</span>
                {m.edited_at && <span className="text-gray/60" title={`Edited ${fmtTime(m.edited_at)}`}>· edited</span>}
              </span>
            </div>
          )
        })}
      </div>

      {errorMsg && (
        <div className="border-t border-red-200 bg-red-50 text-red-700 px-4 py-2 text-[0.78rem] font-franklin">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={submit}
        className="border-t border-lightgray bg-white px-4 py-3 flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit(e)
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Message the group…"
          disabled={sending}
          className="flex-1 resize-none rounded-xl border border-lightgray bg-offwhite px-4 py-2.5 font-franklin text-[0.92rem] text-ink leading-snug focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-gold/20 min-h-[42px] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="bg-navy text-white font-archivo font-black uppercase tracking-[0.08em] text-[0.7rem] px-5 py-2.5 rounded-xl hover:bg-[#13284a] disabled:opacity-30 disabled:cursor-not-allowed transition-all border-0 cursor-pointer h-[42px]"
        >
          Send
        </button>
      </form>
    </section>
  )
}

export default GroupChatPanel
