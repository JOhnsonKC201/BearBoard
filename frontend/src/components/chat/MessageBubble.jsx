import { useEffect, useRef, useState } from 'react'

function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

// 15 minutes — must match EDIT_WINDOW_SECONDS in backend/routers/chat.py.
// Mirrored on the client only to avoid showing an Edit affordance for a
// message we know the server will reject; the server is still the source of
// truth and re-checks the same window.
const EDIT_WINDOW_MS = 15 * 60 * 1000

function withinEditWindow(iso) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < EDIT_WINDOW_MS
}

/**
 * One message in a thread. The visual "grouping" is driven by `firstInGroup` /
 * `lastInGroup` flags computed by ChatPanel: consecutive bubbles from the same
 * sender share a tighter spacing and only the first/last bubble in a streak
 * shows the avatar / name / time.
 */
function MessageBubble({ message, mine, firstInGroup, lastInGroup, showSeen, peerName, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const taRef = useRef(null)

  // Keep the draft in sync if the parent updates the message body (e.g.
  // the server echoed an edit while we were sitting idle).
  useEffect(() => {
    if (!editing) setDraft(message.body)
  }, [message.body, editing])

  useEffect(() => {
    if (!editing) return
    const ta = taRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }, [editing])

  const align = mine ? 'items-end' : 'items-start'

  // Tail shape: rounded except the inside-bottom corner of the last bubble in
  // a streak, which gives the cluster a clear visual anchor.
  const radius = mine
    ? `rounded-2xl ${lastInGroup ? 'rounded-br-md' : ''}`
    : `rounded-2xl ${lastInGroup ? 'rounded-bl-md' : ''}`

  const bubble = mine
    ? 'bg-navy text-white'
    : 'bg-white text-ink border border-lightgray'

  const margin = firstInGroup ? 'mt-3' : 'mt-0.5'

  const canEdit = mine && !!onEdit && withinEditWindow(message.created_at)

  const beginEdit = () => {
    setDraft(message.body)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(message.body)
    setEditing(false)
  }

  const submitEdit = () => {
    const next = draft.trim()
    if (!next) return
    if (next === message.body) {
      setEditing(false)
      return
    }
    const ok = onEdit?.(message.id, next)
    if (ok !== false) {
      // Optimistic close. The server's `message_updated` frame will
      // overwrite the body with the canonical version.
      setEditing(false)
    }
  }

  return (
    <div className={`group flex flex-col ${align} ${margin}`}>
      {firstInGroup && !mine && peerName && (
        <span className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.1em] text-gray/70 px-1 mb-1">
          {peerName}
        </span>
      )}
      <div className={`flex items-end gap-1.5 max-w-full ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`${bubble} ${radius} px-4 py-2 max-w-[78%] font-franklin text-[0.92rem] leading-[1.45] whitespace-pre-wrap break-words shadow-[0_1px_0_rgba(11,29,52,0.04)]`}
        >
          {editing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                ref={taRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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
                className="resize-none rounded-md bg-white/10 text-inherit px-2 py-1 font-franklin text-[0.92rem] leading-snug focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-current/50"
              />
              <div className="flex gap-2 text-[0.7rem] font-archivo font-extrabold uppercase tracking-[0.08em]">
                <button
                  type="button"
                  onClick={submitEdit}
                  className="bg-gold text-navy px-2.5 py-1 rounded-md cursor-pointer border-0 hover:opacity-90"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-transparent text-current/80 px-2.5 py-1 rounded-md cursor-pointer border border-current/30 hover:border-current/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            message.body
          )}
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={beginEdit}
            title="Edit message"
            aria-label="Edit message"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[0.7rem] font-archivo font-extrabold uppercase tracking-[0.08em] text-gray/70 hover:text-navy bg-transparent border-0 cursor-pointer px-1.5 py-1"
          >
            Edit
          </button>
        )}
      </div>
      {lastInGroup && (
        <span className="text-[0.62rem] font-archivo uppercase tracking-[0.08em] text-gray/60 px-1 mt-1 flex items-center gap-1.5">
          <span>{fmtTime(message.created_at)}</span>
          {message.edited_at && (
            <span className="text-gray/60" title={`Edited ${fmtTime(message.edited_at)}`}>· edited</span>
          )}
          {mine && showSeen && message.read_at && (
            <span className="text-gold font-extrabold">· seen</span>
          )}
        </span>
      )}
    </div>
  )
}

export default MessageBubble
