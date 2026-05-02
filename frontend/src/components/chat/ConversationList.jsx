import { useMemo, useState } from 'react'

function initialsFor(name) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function shortPreview(body, max = 64) {
  if (!body) return ''
  const collapsed = body.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed
}

function fmtRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Sidebar with header, search filter, and conversation rows.
 * Active row is marked with a 3px gold left-border, mirroring the post-card
 * convention used elsewhere in BearBoard.
 */
function ConversationList({
  conversations,
  online,
  activePeerId,
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
    <aside className="border-r border-lightgray bg-white flex flex-col min-h-0">
      <div className="px-5 pt-4 pb-3 border-b border-lightgray">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-archivo font-black text-navy text-[1.05rem] tracking-tight">
            Messages
          </h2>
          <button
            type="button"
            onClick={onNewChat}
            className="text-[0.68rem] font-archivo font-black uppercase tracking-[0.08em] bg-gold text-navy px-2.5 py-1.5 rounded hover:bg-[#E5A92E] transition-colors cursor-pointer border-0"
          >
            + New
          </button>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search messages"
          className="w-full bg-offwhite border border-lightgray rounded px-3 py-1.5 font-franklin text-[0.82rem] text-ink focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-gold/20 placeholder:text-gray/60"
          aria-label="Filter conversations"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-5 py-6 text-[0.78rem] font-franklin text-gray/70">Loading…</div>
        ) : error ? (
          <div className="px-5 py-6 text-[0.82rem] font-franklin leading-relaxed">
            <p className="text-red-700 mb-3">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-[0.68rem] font-archivo font-black uppercase tracking-[0.08em] bg-navy text-white px-3 py-1.5 rounded hover:bg-[#13284a] cursor-pointer border-0"
              >
                Try again
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-[0.82rem] font-franklin text-gray/80 leading-relaxed">
            {conversations.length === 0 ? (
              <>
                <p className="mb-2 font-archivo font-extrabold text-navy text-[0.95rem]">No threads yet</p>
                <p>Hit <span className="font-archivo font-extrabold text-navy">+ New</span> to message someone on the board.</p>
              </>
            ) : (
              <p>No matches for "{filter}".</p>
            )}
          </div>
        ) : (
          <ul className="m-0 p-0 list-none">
            {filtered.map((c) => {
              const peer = c.other_user
              const isActive = activePeerId === peer.id
              const isOnline = online.has(peer.id)
              const unread = c.unread_count > 0
              return (
                <li key={peer.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(peer.id)}
                    className={`w-full flex items-start gap-3 pl-4 pr-3 py-3 text-left bg-transparent border-0 cursor-pointer transition-colors relative ${
                      isActive ? 'bg-gold/10' : 'hover:bg-offwhite'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-gold rounded-r" aria-hidden />
                    )}
                    <span className="relative shrink-0">
                      {peer.avatar_url ? (
                        <img
                          src={peer.avatar_url}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover ring-1 ring-lightgray"
                          loading="lazy"
                        />
                      ) : (
                        <span className="w-11 h-11 rounded-full bg-navy text-white flex items-center justify-center font-archivo font-extrabold text-[0.82rem]">
                          {initialsFor(peer.name)}
                        </span>
                      )}
                      {isOnline && (
                        <span
                          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white"
                          aria-label="online"
                        />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`font-archivo font-bold text-[0.88rem] truncate ${unread ? 'text-navy' : 'text-ink'}`}>
                          {peer.name}
                        </span>
                        <span className={`text-[0.66rem] font-archivo uppercase tracking-[0.06em] shrink-0 ${unread ? 'text-gold font-extrabold' : 'text-gray/60'}`}>
                          {fmtRelative(c.last_message?.created_at)}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`block text-[0.78rem] font-franklin truncate ${unread ? 'text-ink font-semibold' : 'text-gray/70'}`}>
                          {shortPreview(c.last_message?.body)}
                        </span>
                        {unread && (
                          <span className="bg-gold text-navy text-[0.62rem] font-archivo font-black uppercase px-2 py-0.5 rounded-full shrink-0">
                            {c.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default ConversationList
