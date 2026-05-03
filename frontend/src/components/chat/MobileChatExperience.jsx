import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import { parseUtcDate } from '../../utils/format'

/**
 * MobileChatExperience — single-pane chat UX for viewports under `lg`.
 *
 * Renders one full-screen view at a time:
 *   - LIST view (no peer selected): "Conversations" header, stories-row of
 *     recent peers, search, and a tap-friendly list of conversations.
 *   - THREAD view (peer selected): back-arrow + peer-name header, messages
 *     using the existing MessageBubble, sticky composer at the bottom.
 *
 * Owns no data of its own — every prop is forwarded from the parent Chat
 * page, so any state mutations / WebSocket frames continue to flow through
 * the same handlers as the desktop view. Failure modes are localized to
 * presentation only.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initialsFor(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

function shortPreview(body, max = 56) {
  if (!body) return ''
  const collapsed = body.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed
}

function fmtRelative(iso) {
  if (!iso) return ''
  const d = parseUtcDate(iso)
  if (!d || Number.isNaN(d.getTime())) return ''
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  if (diff < 172800) return 'Yesterday'
  if (diff < 604800) {
    return d.toLocaleDateString([], { weekday: 'short' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function dayLabel(iso) {
  if (!iso) return ''
  const d = parseUtcDate(iso)
  if (!d || Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yest)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

// Same grouping logic as ChatPanel (consecutive bubbles from the same sender
// within 5 minutes share a tighter cluster). Duplicated locally so we don't
// reach into a desktop-specific export and risk breaking it.
function buildTimeline(messages) {
  const items = []
  let lastDay = null
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const mDate = parseUtcDate(m.created_at)
    const day = mDate ? mDate.toDateString() : ''
    if (day !== lastDay) {
      items.push({ kind: 'day', key: `d-${day}-${i}`, iso: m.created_at })
      lastDay = day
    }
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const prevDate = prev ? parseUtcDate(prev.created_at) : null
    const nextDate = next ? parseUtcDate(next.created_at) : null
    const sameAsPrev =
      prev && prevDate && mDate &&
      prev.from === m.from &&
      prevDate.toDateString() === day &&
      Math.abs(mDate - prevDate) < 5 * 60 * 1000
    const sameAsNext =
      next && nextDate && mDate &&
      next.from === m.from &&
      nextDate.toDateString() === day &&
      Math.abs(nextDate - mDate) < 5 * 60 * 1000
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

// ---------------------------------------------------------------------------
// Inline icons — kept inline so color inherits and the bundle doesn't grow
// with another icon-set import.
// ---------------------------------------------------------------------------

function IconCompose({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconSearch({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconBack({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function IconPaperPlane({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2.4 11.3 21 3.5a.6.6 0 0 1 .8.8l-7.8 18.6a.6.6 0 0 1-1.1 0l-3.3-7.6-7.6-3.3a.6.6 0 0 1 0-1.1z" />
    </svg>
  )
}

function IconPlus({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconCheckSm({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Avatar — round image OR initials with brand-navy backing.
// ---------------------------------------------------------------------------

function Avatar({ peer, size = 44, ring = false }) {
  const ringCls = ring ? 'ring-2 ring-gold ring-offset-2 ring-offset-white' : ''
  const dim = `${size}px`
  if (peer?.avatar_url) {
    return (
      <img
        src={peer.avatar_url}
        alt=""
        loading="lazy"
        decoding="async"
        className={`rounded-full object-cover shrink-0 ${ringCls}`}
        style={{ width: dim, height: dim }}
      />
    )
  }
  return (
    <span
      className={`rounded-full bg-navy text-white flex items-center justify-center font-archivo font-extrabold shrink-0 ${ringCls}`}
      style={{ width: dim, height: dim, fontSize: size * 0.34 }}
      aria-hidden
    >
      {initialsFor(peer?.name)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stories-style horizontal scroll of recent conversation peers. Tapping a
// tile opens that thread; the first tile is a + button that surfaces the
// New Chat modal.
// ---------------------------------------------------------------------------

function StoriesRow({ conversations, online, onPick, onNewChat }) {
  // Top 8 most recently active peers — stories-rail convention.
  const recent = useMemo(() => conversations.slice(0, 8), [conversations])
  return (
    <div className="px-3 pt-3 pb-2 border-b border-lightgray bg-white">
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <button
          type="button"
          onClick={onNewChat}
          className="shrink-0 w-[64px] flex flex-col items-center gap-1.5 bg-transparent border-0 cursor-pointer"
          aria-label="Start a new chat"
        >
          <span className="w-12 h-12 rounded-full bg-offwhite border-2 border-dashed border-navy/40 text-navy flex items-center justify-center">
            <IconPlus size={20} />
          </span>
          <span className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.06em] text-navy">
            New
          </span>
        </button>
        {recent.map((c) => {
          const peer = c.other_user
          const isOnline = online?.has(peer.id)
          const firstName = (peer.name || '').split(/\s+/)[0] || 'Member'
          return (
            <button
              key={peer.id}
              type="button"
              onClick={() => onPick(peer.id)}
              className="shrink-0 w-[64px] flex flex-col items-center gap-1.5 bg-transparent border-0 cursor-pointer"
              aria-label={`Open chat with ${peer.name}`}
            >
              <span className="relative">
                <Avatar peer={peer} size={48} ring />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white" aria-label="online" />
                )}
              </span>
              <span className="text-[0.62rem] font-archivo font-bold text-ink truncate max-w-[60px]">
                {firstName}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Conversation row — single line in the list view.
// ---------------------------------------------------------------------------

function ConversationRow({ conv, isOnline, isMine, onSelect }) {
  const peer = conv.other_user
  const unread = (conv.unread_count || 0) > 0
  const last = conv.last_message
  return (
    <button
      type="button"
      onClick={() => onSelect(peer.id)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 cursor-pointer hover:bg-offwhite active:bg-offwhite/80 transition-colors"
    >
      <span className="relative shrink-0">
        <Avatar peer={peer} size={48} />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white" aria-label="online" />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`font-archivo truncate text-[0.92rem] ${unread ? 'font-black text-navy' : 'font-bold text-ink'}`}>
            {peer.name}
          </span>
          <span className={`text-[0.68rem] font-franklin shrink-0 ${unread ? 'text-gold font-extrabold font-archivo uppercase tracking-[0.06em]' : 'text-gray/60'}`}>
            {fmtRelative(last?.created_at)}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className={`block truncate text-[0.82rem] font-franklin ${unread ? 'text-ink font-semibold' : 'text-gray/75'}`}>
            {isMine && last?.body ? <span className="text-gray/50">You: </span> : null}
            {shortPreview(last?.body) || <span className="italic text-gray/50">Say hi.</span>}
          </span>
          {unread ? (
            <span
              className="bg-gold text-navy text-[0.62rem] font-archivo font-black px-2 min-w-[20px] h-5 inline-flex items-center justify-center rounded-full shrink-0"
              aria-label={`${conv.unread_count} unread`}
            >
              {conv.unread_count}
            </span>
          ) : last?.read_at && isMine ? (
            <span className="shrink-0 text-gold" aria-label="Read" title="Read">
              <IconCheckSm />
            </span>
          ) : null}
        </span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// LIST VIEW
// ---------------------------------------------------------------------------

function MobileListView({
  conversations,
  online,
  meId,
  onSelect,
  onNewChat,
  loading,
  error,
  onRetry,
}) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((c) => {
      const name = c.other_user?.name?.toLowerCase() || ''
      const last = c.last_message?.body?.toLowerCase() || ''
      return name.includes(term) || last.includes(term)
    })
  }, [filter, conversations])

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] bg-white">
      {/* Header */}
      <header className="px-5 pt-4 pb-3 flex items-center justify-between bg-white border-b border-lightgray shrink-0">
        <h1 className="font-archivo font-black text-navy text-[1.35rem] tracking-tight m-0">
          Conversations
        </h1>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          className="w-10 h-10 flex items-center justify-center text-navy hover:text-gold bg-transparent border-0 cursor-pointer transition-colors"
        >
          <IconCompose />
        </button>
      </header>

      {/* Stories row — only when there are recent conversations to populate it */}
      {conversations.length > 0 && (
        <StoriesRow
          conversations={conversations}
          online={online}
          onPick={onSelect}
          onNewChat={onNewChat}
        />
      )}

      {/* Search */}
      <div className="px-4 py-3 bg-white shrink-0">
        <label className="flex items-center gap-2 bg-offwhite border border-lightgray rounded-full px-4 py-2.5">
          <span className="text-gray/60"><IconSearch /></span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search messages"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none font-franklin text-[0.92rem] text-ink placeholder:text-gray/60"
            aria-label="Search conversations"
          />
        </label>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="px-5 py-8 text-center text-[0.86rem] font-franklin text-gray/70">
            Loading conversations…
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-[0.88rem] font-franklin">
            <p className="text-red-700 mb-3">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-[0.7rem] font-archivo font-black uppercase tracking-[0.08em] bg-navy text-white px-3 py-1.5 rounded cursor-pointer border-0"
              >
                Try again
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center font-franklin text-gray/80">
            {conversations.length === 0 ? (
              <>
                <p className="font-archivo font-extrabold text-navy text-[1.05rem] mb-2">
                  No threads yet
                </p>
                <p className="text-[0.92rem] leading-relaxed">
                  Tap the compose icon to message someone on the board.
                </p>
              </>
            ) : (
              <p>No matches for "{filter}".</p>
            )}
          </div>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-lightgray">
            {filtered.map((c) => (
              <li key={c.other_user.id}>
                <ConversationRow
                  conv={c}
                  isOnline={online?.has(c.other_user.id)}
                  isMine={c.last_message?.sender_id === meId}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// THREAD VIEW
// ---------------------------------------------------------------------------

function StatusPill({ status }) {
  if (status === 'open') return null
  const text =
    status === 'reconnecting' ? 'Reconnecting' :
    status === 'connecting' ? 'Connecting' :
    status === 'closed' ? 'Offline' :
    status === 'unauth' ? 'Sign in' : null
  if (!text) return null
  const tone = status === 'unauth'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-gold/15 text-gold border-gold/30'
  return (
    <span className={`text-[0.6rem] font-archivo font-extrabold uppercase tracking-[0.1em] px-2 py-1 border ${tone}`}>
      {text}
    </span>
  )
}

function MobileThreadView({
  meId,
  peer,
  messages,
  isPeerTyping,
  status,
  errorMessage,
  onSend,
  onTypingPing,
  onEdit,
  onBack,
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

  // Auto-scroll to bottom when new messages land or the peer starts typing.
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, peer?.id, isPeerTyping])

  // Auto-grow the textarea up to a reasonable cap.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(120, ta.scrollHeight) + 'px'
  }, [draft])

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

  const headerName = peer?.name || 'Conversation'

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] bg-offwhite">
      {/* Header — back arrow + peer chip */}
      <header className="px-3 py-2.5 bg-white border-b border-lightgray flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="w-10 h-10 flex items-center justify-center bg-transparent border-0 cursor-pointer text-navy hover:text-gold transition-colors"
        >
          <IconBack />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Avatar peer={peer} size={36} />
          <div className="min-w-0 flex-1">
            <div className="font-archivo font-black text-navy text-[0.95rem] truncate leading-tight">
              {headerName}
            </div>
            {peer?.major && (
              <div className="text-[0.66rem] font-franklin text-gray/70 truncate">
                {peer.major}
              </div>
            )}
          </div>
        </div>
        <StatusPill status={status} />
      </header>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 flex flex-col">
        {timeline.length === 0 ? (
          <div className="m-auto text-center max-w-[260px]">
            <p className="font-franklin text-[0.88rem] text-gray/70 leading-relaxed">
              Say hi to{' '}
              <span className="font-archivo font-bold text-navy">
                {(peer?.name || 'them').split(' ')[0]}
              </span>
              . They'll see your message the moment it lands.
            </p>
          </div>
        ) : (
          timeline.map((item) => {
            if (item.kind === 'day') {
              return (
                <div key={item.key} className="my-3 flex items-center gap-3">
                  <span className="flex-1 h-px bg-lightgray" />
                  <span className="text-[0.6rem] font-archivo font-extrabold uppercase tracking-[0.12em] text-gray/60">
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
                peerName={peer?.name}
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
        <div className="border-t border-red-200 bg-red-50 text-red-700 px-4 py-2 text-[0.78rem] font-franklin shrink-0">
          {errorMessage}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={submit}
        className="border-t border-lightgray bg-white px-3 py-2.5 flex items-end gap-2 shrink-0"
      >
        {/* Reserved + button — currently a no-op so the visual matches the
            spec. Wires up to attachments once 1-on-1 chat supports them
            (group chat has the upload pipeline; bringing it to DMs is a
            separate change). Kept as `disabled` so screen readers report
            it correctly. */}
        <button
          type="button"
          disabled
          aria-label="Attachments coming soon"
          title="Attachments coming soon"
          className="shrink-0 w-10 h-10 rounded-full bg-offwhite text-gray/50 border border-lightgray flex items-center justify-center cursor-not-allowed"
        >
          <IconPlus />
        </button>
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
          placeholder={`Message ${(peer?.name || 'them').split(' ')[0]}…`}
          className="flex-1 min-w-0 resize-none rounded-2xl border border-lightgray bg-offwhite px-4 py-2.5 font-franklin text-[0.92rem] text-ink leading-snug focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-gold/20 min-h-[42px]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="shrink-0 w-10 h-10 rounded-full bg-gold text-navy hover:bg-[#E5A92E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center cursor-pointer border-0"
        >
          <IconPaperPlane />
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Container — picks list vs thread based on whether a peer is selected.
// ---------------------------------------------------------------------------

function MobileChatExperience({
  meId,
  conversations,
  online,
  activePeerId,
  peer,
  messages,
  isPeerTyping,
  status,
  errorMessage,
  loading,
  error,
  onRetry,
  onSelect,
  onNewChat,
  onSend,
  onTypingPing,
  onEdit,
  onBack,
}) {
  if (activePeerId) {
    return (
      <MobileThreadView
        meId={meId}
        peer={peer}
        messages={messages}
        isPeerTyping={isPeerTyping}
        status={status}
        errorMessage={errorMessage}
        onSend={onSend}
        onTypingPing={onTypingPing}
        onEdit={onEdit}
        onBack={onBack}
      />
    )
  }
  return (
    <MobileListView
      conversations={conversations}
      online={online}
      meId={meId}
      onSelect={onSelect}
      onNewChat={onNewChat}
      loading={loading}
      error={error}
      onRetry={onRetry}
    />
  )
}

export default MobileChatExperience
