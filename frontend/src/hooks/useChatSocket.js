import { useCallback, useEffect, useRef, useState } from 'react'
import { API_URL } from '../api/client'

/**
 * Owns the WebSocket lifecycle for BearChat.
 *
 * Responsibilities:
 *  - Convert API_URL (http/https) to its ws/wss equivalent and append
 *    /api/chat/ws?token=<jwt>.
 *  - Reconnect with exponential backoff on close/error.
 *  - Heartbeat with ping every 25s so idle proxies don't drop the socket.
 *  - Re-emit inbound frames as typed events (message/typing/read/presence/hello)
 *    so the consuming page doesn't have to decode JSON itself.
 *
 * Returns { status, send, online }, where:
 *   status  - 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unauth'
 *   send    - (frame: object) => boolean  (false if not open)
 *   online  - Set<number> of currently-online user ids (excluding self)
 *
 * Subscribers register handlers via `on(type, fn)`; the hook returns the
 * `on` function and the consumer calls it inside useEffect with cleanup.
 */
export function useChatSocket({ token, onMessage, onTyping, onRead }) {
  const [status, setStatus] = useState('connecting')
  const [online, setOnline] = useState(() => new Set())
  // userId -> ISO string of last time we saw them go offline.
  const [lastSeen, setLastSeen] = useState(() => new Map())
  const wsRef = useRef(null)
  const retryRef = useRef(0)
  const heartbeatRef = useRef(null)
  const closedByConsumerRef = useRef(false)
  const handlersRef = useRef({ onMessage, onTyping, onRead })

  // Keep latest handler closures available without retriggering the effect.
  useEffect(() => {
    handlersRef.current = { onMessage, onTyping, onRead }
  }, [onMessage, onTyping, onRead])

  const wsUrl = useCallback(() => {
    if (!token) return null
    const base = API_URL.replace(/^http(s?):/i, (_, s) => `ws${s}:`)
    return `${base}/api/chat/ws?token=${encodeURIComponent(token)}`
  }, [token])

  const connect = useCallback(() => {
    const url = wsUrl()
    if (!url) {
      setStatus('closed')
      return
    }
    setStatus(retryRef.current === 0 ? 'connecting' : 'reconnecting')
    let ws
    try {
      ws = new WebSocket(url)
    } catch {
      setStatus('closed')
      scheduleReconnect()
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      retryRef.current = 0
      setStatus('open')
      // Heartbeat: ping every 25s. The 30s window is the sweet spot
      // between Render's idle-timeout and not flooding the connection.
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25_000)
    }

    ws.onmessage = (ev) => {
      let frame
      try { frame = JSON.parse(ev.data) } catch { return }
      const t = frame?.type
      if (t === 'pong') return
      if (t === 'hello') {
        setOnline(new Set(frame.online_users || []))
        return
      }
      if (t === 'presence') {
        setOnline((prev) => {
          const next = new Set(prev)
          if (frame.online) next.add(frame.user_id)
          else next.delete(frame.user_id)
          return next
        })
        if (!frame.online && frame.last_seen) {
          setLastSeen((prev) => {
            const next = new Map(prev)
            next.set(frame.user_id, frame.last_seen)
            return next
          })
        }
        return
      }
      const h = handlersRef.current
      if (t === 'message' && h.onMessage) h.onMessage(frame)
      else if (t === 'typing' && h.onTyping) h.onTyping(frame)
      else if (t === 'read' && h.onRead) h.onRead(frame)
    }

    ws.onclose = (ev) => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      wsRef.current = null
      if (closedByConsumerRef.current) {
        setStatus('closed')
        return
      }
      // 4401 = bad token. No point reconnecting; the user needs to re-auth.
      if (ev.code === 4401) {
        setStatus('unauth')
        return
      }
      setStatus('reconnecting')
      scheduleReconnect()
    }

    ws.onerror = () => {
      // The 'close' handler runs after this on most browsers, so leave
      // backoff orchestration there. Just don't crash.
    }
  }, [wsUrl])

  const scheduleReconnect = useCallback(() => {
    const attempt = retryRef.current
    retryRef.current = attempt + 1
    // 1s, 2s, 4s, 8s, 16s, 30s cap.
    const delay = Math.min(30_000, 1000 * 2 ** attempt)
    setTimeout(() => {
      if (!closedByConsumerRef.current) connect()
    }, delay)
  }, [connect])

  useEffect(() => {
    closedByConsumerRef.current = false
    if (!token) {
      setStatus('closed')
      return
    }
    connect()
    return () => {
      closedByConsumerRef.current = true
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      const ws = wsRef.current
      wsRef.current = null
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.close(1000, 'unmount') } catch {}
      }
    }
  }, [token, connect])

  const send = useCallback((frame) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      ws.send(JSON.stringify(frame))
      return true
    } catch {
      return false
    }
  }, [])

  return { status, send, online, lastSeen }
}
