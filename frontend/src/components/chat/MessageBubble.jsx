function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * One message in a thread. The visual "grouping" is driven by `firstInGroup` /
 * `lastInGroup` flags computed by ChatPanel: consecutive bubbles from the same
 * sender share a tighter spacing and only the first/last bubble in a streak
 * shows the avatar / name / time.
 */
function MessageBubble({ message, mine, firstInGroup, lastInGroup, showSeen, peerName }) {
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

  return (
    <div className={`flex flex-col ${align} ${margin}`}>
      {firstInGroup && !mine && peerName && (
        <span className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.1em] text-gray/70 px-1 mb-1">
          {peerName}
        </span>
      )}
      <div
        className={`${bubble} ${radius} px-4 py-2 max-w-[78%] font-franklin text-[0.92rem] leading-[1.45] whitespace-pre-wrap break-words shadow-[0_1px_0_rgba(11,29,52,0.04)]`}
      >
        {message.body}
      </div>
      {lastInGroup && (
        <span className="text-[0.62rem] font-archivo uppercase tracking-[0.08em] text-gray/60 px-1 mt-1 flex items-center gap-1.5">
          <span>{fmtTime(message.created_at)}</span>
          {mine && showSeen && message.read_at && (
            <span className="text-gold font-extrabold">· seen</span>
          )}
        </span>
      )}
    </div>
  )
}

export default MessageBubble
