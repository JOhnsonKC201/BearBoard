import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api/client'
import { useChatSocket } from '../hooks/useChatSocket'
import ConversationList from '../components/chat/ConversationList'
import ChatPanel from '../components/chat/ChatPanel'
import NewChatModal from '../components/chat/NewChatModal'

/**
 * /chat — BearChat home.
 *
 * Layout: two-column (conversation list left, active thread right) on lg+,
 * stacks on mobile. The URL param /chat/:userId selects a peer; selecting a
 * conversation pushes a new URL.
 *
 * Data model in this page:
 *   conversations  : last-message-per-peer rows (REST /conversations)
 *   activePeerId   : the peer whose thread is open in ChatPanel
 *   peers          : id → user object cache (for thread headers)
 *   threads        : peerId → array of messages, oldest first
 *   typing         : Set<peerId> currently typing
 */
function Chat() {
  const { user, token, isAuthed, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const params = useParams()
  const urlPeerId = params.userId ? Number(params.userId) : null

  const [conversations, setConversations] = useState([])
  const [convosLoading, setConvosLoading] = useState(true)
  const [convosError, setConvosError] = useState(null)
  const [activePeerId, setActivePeerId] = useState(urlPeerId)
  const [peers, setPeers] = useState({})  // id -> user
  const [threads, setThreads] = useState({})  // peerId -> Message[]
  const [typingPeers, setTypingPeers] = useState(() => new Set())
  const [showNew, setShowNew] = useState(false)
  const typingTimersRef = useRef({})

  // ---------------------------------------------------------------------
  // WS handlers
  // ---------------------------------------------------------------------
  const handleMessage = useCallback((frame) => {
    if (!user) return
    const peerId = frame.from === user.id ? frame.to : frame.from
    setThreads((prev) => {
      const existing = prev[peerId] || []
      // Drop dupes if the server echoes a message we already have.
      if (existing.some((m) => m.id === frame.id)) return prev
      return { ...prev, [peerId]: [...existing, { ...frame }] }
    })
    // Bump the conversation list. If it doesn't exist yet (first message
    // with this peer), refetch so we get the peer's UserPublicResponse.
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.other_user.id === peerId)
      const lastMsg = {
        id: frame.id,
        sender_id: frame.from,
        recipient_id: frame.to,
        body: frame.body,
        created_at: frame.created_at,
        read_at: frame.read_at || null,
      }
      if (idx === -1) {
        // Lazy refetch — cheap and avoids us inventing a partial peer object.
        refetchConversations()
        return prev
      }
      const incomingUnread =
        frame.to === user.id && peerId !== activePeerId
          ? prev[idx].unread_count + 1
          : prev[idx].unread_count
      const updated = { ...prev[idx], last_message: lastMsg, unread_count: incomingUnread }
      const next = [updated, ...prev.filter((_, i) => i !== idx)]
      return next
    })
  }, [user, activePeerId])

  const handleTyping = useCallback((frame) => {
    const fromId = frame.from
    setTypingPeers((prev) => {
      const next = new Set(prev)
      next.add(fromId)
      return next
    })
    // Clear after 3s of no further pings.
    if (typingTimersRef.current[fromId]) {
      clearTimeout(typingTimersRef.current[fromId])
    }
    typingTimersRef.current[fromId] = setTimeout(() => {
      setTypingPeers((prev) => {
        const next = new Set(prev)
        next.delete(fromId)
        return next
      })
    }, 3000)
  }, [])

  const handleRead = useCallback((frame) => {
    const peerId = frame.by
    const upTo = frame.up_to_id
    setThreads((prev) => {
      const existing = prev[peerId]
      if (!existing) return prev
      let mutated = false
      const updated = existing.map((m) => {
        if (m.from === user?.id && m.id <= upTo && !m.read_at) {
          mutated = true
          return { ...m, read_at: new Date().toISOString() }
        }
        return m
      })
      return mutated ? { ...prev, [peerId]: updated } : prev
    })
  }, [user])

  const { status, send, online, lastSeen } = useChatSocket({
    token,
    onMessage: handleMessage,
    onTyping: handleTyping,
    onRead: handleRead,
  })

  // ---------------------------------------------------------------------
  // REST loaders
  // ---------------------------------------------------------------------
  const refetchConversations = useCallback(() => {
    setConvosLoading(true)
    setConvosError(null)
    apiFetch('/api/chat/conversations')
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setConversations(list)
        setPeers((prev) => {
          const next = { ...prev }
          for (const c of list) next[c.other_user.id] = c.other_user
          return next
        })
      })
      .catch((err) => {
        // Show the user something actionable instead of silently spinning.
        const msg = err?.message || 'Could not load your messages.'
        setConvosError(msg)
        // Surface in console for the dev who's debugging.
        // eslint-disable-next-line no-console
        console.error('chat: refetchConversations failed', err)
      })
      .finally(() => setConvosLoading(false))
  }, [])

  useEffect(() => {
    if (!isAuthed) return
    refetchConversations()
  }, [isAuthed, refetchConversations])

  // Sync URL :userId param into activePeerId whenever it changes.
  useEffect(() => {
    if (urlPeerId && urlPeerId !== activePeerId) {
      setActivePeerId(urlPeerId)
    }
  }, [urlPeerId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Whenever the active peer changes, fetch history (if not cached) and
  // ensure we have the peer's profile.
  useEffect(() => {
    if (!activePeerId || !isAuthed) return
    if (!threads[activePeerId]) {
      apiFetch(`/api/chat/messages?with=${activePeerId}&limit=50`, { cache: false })
        .then((data) => {
          const msgs = Array.isArray(data) ? data.map((m) => ({
            id: m.id,
            from: m.sender_id,
            to: m.recipient_id,
            body: m.body,
            created_at: m.created_at,
            read_at: m.read_at,
          })) : []
          setThreads((prev) => ({ ...prev, [activePeerId]: msgs }))
        })
        .catch(() => {})
    }
    if (!peers[activePeerId]) {
      apiFetch(`/api/users/${activePeerId}`, { cache: false })
        .then((u) => setPeers((prev) => ({ ...prev, [activePeerId]: u })))
        .catch(() => {})
    }
  }, [activePeerId, isAuthed]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the active thread is open and contains unread messages from the
  // peer, immediately mark them as read (mirror Slack/Messenger behavior).
  useEffect(() => {
    if (!activePeerId || !user) return
    const thread = threads[activePeerId] || []
    const hasUnreadFromPeer = thread.some((m) => m.from === activePeerId && !m.read_at)
    if (!hasUnreadFromPeer) return
    // Optimistic local clear, then notify server.
    setThreads((prev) => {
      const list = prev[activePeerId] || []
      const now = new Date().toISOString()
      return {
        ...prev,
        [activePeerId]: list.map((m) =>
          m.from === activePeerId && !m.read_at ? { ...m, read_at: now } : m
        ),
      }
    })
    setConversations((prev) =>
      prev.map((c) => (c.other_user.id === activePeerId ? { ...c, unread_count: 0 } : c))
    )
    send({ type: 'read', with: activePeerId })
  }, [activePeerId, threads, user, send])

  // ---------------------------------------------------------------------
  // User actions
  // ---------------------------------------------------------------------
  const onSelect = (peerId) => {
    setActivePeerId(peerId)
    navigate(`/chat/${peerId}`, { replace: true })
  }

  const onPickNewUser = (u) => {
    setPeers((prev) => ({ ...prev, [u.id]: u }))
    onSelect(u.id)
  }

  const onSend = useCallback((body) => {
    if (!activePeerId) return false
    return send({ type: 'send', to: activePeerId, body })
  }, [activePeerId, send])

  const onTypingPing = useCallback(() => {
    if (!activePeerId) return
    send({ type: 'typing', to: activePeerId })
  }, [activePeerId, send])

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (authLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center font-franklin text-gray/70">Loading…</div>
  }
  if (!isAuthed) {
    return (
      <div className="max-w-md mx-auto my-16 px-6 text-center">
        <h1 className="font-archivo font-black text-navy text-2xl mb-3">Sign in to chat</h1>
        <p className="font-franklin text-ink/80 mb-6">BearChat is for verified Morgan students. Log in or create an account to start a thread.</p>
        <button
          onClick={() => navigate('/login')}
          className="bg-gold text-navy font-archivo font-extrabold uppercase tracking-wide px-5 py-2.5 cursor-pointer border-0"
        >
          Go to login
        </button>
      </div>
    )
  }

  const activePeer = activePeerId ? peers[activePeerId] : null
  const activeThread = activePeerId ? (threads[activePeerId] || []) : []
  const isPeerTyping = activePeerId ? typingPeers.has(activePeerId) : false
  const isPeerOnline = activePeerId ? online.has(activePeerId) : false
  // Prefer the live WS-pushed value; fall back to whatever the conversations
  // endpoint shipped on initial load. Either way it's an ISO string or null.
  const peerLastSeen = activePeerId
    ? (lastSeen.get(activePeerId)
        || conversations.find((c) => c.other_user.id === activePeerId)?.peer_last_seen
        || null)
    : null

  return (
    <div className="max-w-7xl mx-auto px-2 lg:px-6 py-4 lg:py-6">
      <div
        className="grid border border-lightgray bg-white shadow-[0_2px_0_rgba(11,29,52,0.04)] overflow-hidden"
        style={{
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          height: 'calc(100vh - 140px)',
          minHeight: '520px',
        }}
      >
        <ConversationList
          conversations={conversations}
          online={online}
          activePeerId={activePeerId}
          onSelect={onSelect}
          onNewChat={() => setShowNew(true)}
          loading={convosLoading}
          error={convosError}
          onRetry={refetchConversations}
        />
        <ChatPanel
          meId={user?.id}
          peer={activePeer}
          messages={activeThread}
          isOnline={isPeerOnline}
          peerLastSeen={peerLastSeen}
          isPeerTyping={isPeerTyping}
          status={status}
          onSend={onSend}
          onTypingPing={onTypingPing}
        />
      </div>
      <NewChatModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onPick={onPickNewUser}
      />
    </div>
  )
}

export default Chat
