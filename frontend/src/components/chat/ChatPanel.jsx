import { useEffect, useMemo, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'

function initialsFor(name) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function activeLabel(isOnline, lastSeenIso) {
  if (isOnline) return 'Active now'
  if (!lastSeenIso) return 'Offline'
  const d = new Date(lastSeenIso)
  const diffSec = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (diffSec < 60) return 'Active just now'
  if (diffSec < 3600) return `Active ${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `Active ${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `Active ${Math.floor(diffSec / 86400)}d ago`
  return `Active ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

function dayLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yest)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

/**
 * Build the rendered timeline: an interleaved list of day separators and
 * grouped message bubbles. Two consecutive messages are "grouped" when they
 * share a sender and are <5 minutes apart.
 */
function buildTimeline(messages) {
  const items = []
  let lastDay = null
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const day = new Date(m.created_at).toDateString()
    if (day !== lastDay) {
      items.push({ kind: 'day', key: `d-${day}`, iso: m.created_at })
      lastDay = day
    }
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const sameAsPrev =
      prev &&
      prev.from === m.from &&
      new Date(prev.created_at).toDateString() === day &&
      Math.abs(new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000
    const sameAsNext =
      next &&
      next.from === m.from &&
      new Date(next.created_at).toDateString() === day &&
      Math.abs(new Date(next.created_at) - new Date(m.created_at)) < 5 * 60 * 1000
    items.push({
      kind: 'msg',
      key: `m-${m.id}`,
      message: m,
      firstInGroup: !sameAsPrev,
      lastInGroup: !sameAsNext,
    })
  }
  return items
}

function StatusPill({ status }) {
  if (status === 'open') return null
  const text =
    status === 'reconnecting' ? 'Reconnecting' :
    status === 'connecting' ? 'Connecting' :
    status === 'closed' ? 'Offline' :
    status === 'unauth' ? 'Sign in to chat' : null
  if (!text) return null
  const tone =
    status === 'unauth' ? 'bg-red-50 text-red-700 border-red-200' :
    'bg-gold/15 text-gold border-gold/30'
  return (
    <span className={`text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.1em] px-2 py-1 border ${tone}`}>
      {text}
    </span>
  )
}

function ChatPanel({
  meId,
  peer,
  messages,
  isOnline,
  peerLastSeen,
  isPeerTyping,
  status,
  errorMessage,
  onSend,
  onTypingPing,
  onEdit,
}) {
  const [draft, setDraft] = useState('')
  const scrollerRef = useRef(null)
  const taRef = useRef(null)
  const lastTypingPingRef = useRef(0)

  const lastMineReadId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.from === meId && m.read_at) return m.id
    }
    return null
  }, [messages, meId])

  const timeline = useMemo(() => buildTimeline(messages), [messages])

  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, peer?.id, isPeerTyping])

  // Auto-grow the textarea up to a cap so a multi-line message is readable.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px'
  }, [draft])

  if (!peer) {
    return (
      <section className="flex-1 flex items-center justify-center p-10 bg-offwhite">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-navy text-gold flex items-center justify-center font-archivo font-black text-2xl mb-4">
            BC
          </div>
          <h2 className="font-archivo font-black text-navy text-xl mb-2">BearChat</h2>
          <p className="font-franklin text-[0.92rem] text-ink/80 leading-relaxed">
            Pick a thread on the left, or start a new one. Messages send instantly when both of you are on, and they wait in the inbox if not.
          </p>
        </div>
      </section>
    )
  }

  const submit = (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    if (onSend(body)) setDraft('')
  }

  const onChange = (e) => {
    setDraft(e.target.value)
    const now = Date.now()
    if (now - lastTypingPingRef.current > 1500) {
      lastTypingPingRef.current = now
      onTypingPing?.()
    }
  }

  return (
    <section className="flex-1 flex flex-col min-h-0 bg-offwhite">
      <header className="px-5 py-3.5 border-b border-lightgray bg-white flex items-center gap-3">
        <span className="relative shrink-0">
          {peer.avatar_url ? (
            <img src={peer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-lightgray" />
          ) : (
            <span className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-archivo font-extrabold text-[0.78rem]">
              {initialsFor(peer.name)}
            </span>
          )}
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-archivo font-black text-navy text-[1rem] truncate leading-none mb-1">
            {peer.name}
          </div>
          <div className="text-[0.7rem] font-franklin flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray/40'}`} />
            <span className="text-gray/80">
              {activeLabel(isOnline, peerLastSeen)}
              {peer.major ? ` · ${peer.major}` : ''}
            </span>
          </div>
        </div>
        <StatusPill status={status} />
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col">
        {timeline.length === 0 ? (
          <div className="m-auto text-center max-w-xs">
            <p className="font-franklin text-[0.88rem] text-gray/70 leading-relaxed">
              Say hi to <span className="font-archivo font-bold text-navy">{peer.name.split(' ')[0]}</span>. They'll see your message the moment it lands.
            </p>
          </div>
        ) : (
          timeline.map((item) => {
            if (item.kind === 'day') {
              return (
                <div key={item.key} className="my-3 flex items-center gap-3">
                  <span className="flex-1 h-px bg-lightgray" />
                  <span className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.12em] text-gray/60">
                    {dayLabel(item.iso)}
                  </span>
                  <span className="flex-1 h-px bg-lightgray" />
                </div>
              )
            }
            const m = item.message
            return (
              <MessageBubble
                key={item.key}
                message={m}
                mine={m.from === meId}
                firstInGroup={item.firstInGroup}
                lastInGroup={item.lastInGroup}
                showSeen={m.id === lastMineReadId}
                peerName={peer.name}
                onEdit={onEdit}
              />
            )
          })
        )}
        {isPeerTyping && (
          <div className="self-start mt-2 flex items-center gap-1.5 px-3 py-2 bg-white border border-lightgray rounded-2xl">
            <span className="w-1.5 h-1.5 rounded-full bg-gray/60 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-gray/60 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-gray/60 animate-bounce" />
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="border-t border-red-200 bg-red-50 text-red-700 px-4 py-2 text-[0.78rem] font-franklin">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={submit}
        className="border-t border-lightgray bg-white px-4 py-3 flex items-end gap-2"
      >
        <textarea
          ref={taRef}
          value={draft}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit(e)
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={`Message ${peer.name.split(' ')[0]}…`}
          className="flex-1 resize-none rounded-xl border border-lightgray bg-offwhite px-4 py-2.5 font-franklin text-[0.92rem] text-ink leading-snug focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-gold/20 min-h-[42px]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="bg-navy text-white font-archivo font-black uppercase tracking-[0.08em] text-[0.7rem] px-5 py-2.5 rounded-xl hover:bg-[#13284a] disabled:opacity-30 disabled:cursor-not-allowed transition-all border-0 cursor-pointer h-[42px]"
        >
          Send
        </button>
      </form>
    </section>
  )
}

export default ChatPanel
