"""
Render BearChat source-code snippets as paper-ready PNG images.

Each snippet maps to a subsection of the paper. The output PNGs go in this
same folder so they're easy to drop into a Word doc.

Run from the repo root:
    python docs/paper-snippets/render_snippets.py
"""
from pathlib import Path

from pygments import highlight
from pygments.formatters import ImageFormatter
from pygments.lexers import PythonLexer, JavascriptLexer

OUT = Path(__file__).parent

# (filename, lexer, title, body)
SNIPPETS = []

# ---------------------------------------------------------------------------
# 3.2  The WebSocket Protocol  -  HTTP Upgrade handshake
# ---------------------------------------------------------------------------
SNIPPETS.append((
    "01_websocket_handshake.png",
    PythonLexer(),
    "Server-side WebSocket endpoint (HTTP Upgrade per RFC 6455)",
    '''# routers/chat.py

@router.websocket("/ws")
async def chat_ws(websocket: WebSocket,
                  token: Optional[str] = Query(default=None)):
    # Performs the RFC 6455 HTTP Upgrade handshake.
    await websocket.accept()

    try:
        user_id = decode_jwt_user_id(token or "")
    except InvalidToken:
        # 4401 = our app-level "auth failed" close code.
        await websocket.close(code=4401)
        return

    is_first = await manager.connect(user_id, websocket)
    if is_first:
        for peer_id in manager.online_users():
            if peer_id != user_id:
                await manager.send_to(peer_id, {
                    "type": "presence",
                    "user_id": user_id,
                    "online": True,
                })

    await websocket.send_json({
        "type": "hello",
        "user_id": user_id,
        "online_users": sorted(
            uid for uid in manager.online_users() if uid != user_id
        ),
    })
'''
))

# ---------------------------------------------------------------------------
# 3.3  Real-Time Messaging Architecture  -  ConnectionManager
# ---------------------------------------------------------------------------
SNIPPETS.append((
    "02_connection_manager.png",
    PythonLexer(),
    "ConnectionManager: per-user fan-out and presence",
    '''# services/chat_manager.py

class ConnectionManager:
    """In-process registry of live WebSocket connections, keyed by user id.
    A user can have multiple sockets (laptop + phone), so we store a set.
    """

    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = {}
        self._last_seen: dict[int, datetime] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> bool:
        async with self._lock:
            existing = self._sockets.setdefault(user_id, set())
            first = len(existing) == 0
            existing.add(websocket)
        return first

    async def send_to(self, user_id: int, payload: dict) -> int:
        """Push payload to every live socket the user has open."""
        async with self._lock:
            sockets = list(self._sockets.get(user_id, ()))
        delivered = 0
        for ws in sockets:
            try:
                await ws.send_json(payload)
                delivered += 1
            except Exception:
                pass  # dead socket; reaped below
        return delivered

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))
'''
))

# ---------------------------------------------------------------------------
# 3.3  (continued) - The send-handler that ties messaging + persistence
# ---------------------------------------------------------------------------
SNIPPETS.append((
    "03_send_handler.png",
    PythonLexer(),
    "Send-handler: persist + fan-out + offline notification",
    '''# routers/chat.py

async def _handle_send(sender_id: int, frame: dict, ws: WebSocket) -> None:
    payload = ChatMessageCreate(
        recipient_id=int(frame.get("to")),
        body=str(frame.get("body", "")),
    )

    with SessionLocal() as db:
        # 1. Write to Postgres so the conversation persists.
        msg = ChatMessage(
            sender_id=sender_id,
            recipient_id=payload.recipient_id,
            body=payload.body.strip(),
        )
        db.add(msg)

        # 2. If recipient is offline, queue a notification row.
        if not manager.is_online(payload.recipient_id):
            _ensure_chat_notification(
                db, payload.recipient_id, sender_id,
            )

        db.commit()
        db.refresh(msg)
        wire = _serialize_message(msg)

    # 3. Live fan-out: echo to sender, push to recipient.
    out = {"type": "message", **wire}
    await manager.send_to(sender_id, out)
    await manager.send_to(payload.recipient_id, out)
'''
))

# ---------------------------------------------------------------------------
# 3.4  Comparison: WebSocket client (one persistent connection)
# ---------------------------------------------------------------------------
SNIPPETS.append((
    "04_websocket_client.png",
    JavascriptLexer(),
    "Browser-side WebSocket client (one persistent connection)",
    '''// hooks/useChatSocket.js

const wsUrl = useCallback(() => {
    if (!token) return null
    // Convert http(s):// API base to ws(s):// and append the WS route.
    const base = API_URL.replace(
        /^http(s?):/i, (_, s) => `ws${s}:`,
    )
    return `${base}/api/chat/ws?token=${encodeURIComponent(token)}`
}, [token])

const connect = useCallback(() => {
    const url = wsUrl()
    if (!url) return
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
        retryRef.current = 0
        setStatus("open")
        // Heartbeat every 25s so idle proxies don't drop the socket.
        heartbeatRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "ping" }))
            }
        }, 25_000)
    }

    ws.onmessage = (ev) => {
        const frame = JSON.parse(ev.data)
        if (frame.type === "message") onMessage(frame)
        else if (frame.type === "typing") onTyping(frame)
        else if (frame.type === "presence") updatePresence(frame)
    }

    ws.onclose = (ev) => {
        if (ev.code === 4401) { setStatus("unauth"); return }
        scheduleReconnect()  // exponential backoff
    }
}, [wsUrl])
'''
))

# ---------------------------------------------------------------------------
# 3.4  Migration / database schema for chat_messages
# ---------------------------------------------------------------------------
SNIPPETS.append((
    "05_chat_message_model.png",
    PythonLexer(),
    "ChatMessage model and database indexes",
    '''# models/chat_message.py

class ChatMessage(Base):
    """A 1:1 direct message between two users.
    Conversations are implicit: the unordered pair
    {sender_id, recipient_id} defines a thread.
    """

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(
        DateTime, server_default=func.now(), nullable=False,
    )
    read_at = Column(DateTime, nullable=True)

    __table_args__ = (
        # History pulls between A and B, ordered by created_at.
        Index("ix_chat_msg_pair_created",
              "sender_id", "recipient_id", "created_at"),
        # Unread-count lookups for a recipient.
        Index("ix_chat_msg_recipient_unread",
              "recipient_id", "read_at"),
    )
'''
))


def render():
    formatter = ImageFormatter(
        font_name="Consolas",
        font_size=18,
        line_numbers=True,
        line_number_bg="#0B1D34",
        line_number_fg="#7a8294",
        line_number_pad=10,
        image_pad=18,
        line_pad=4,
        style="monokai",
        image_format="PNG",
    )

    for filename, lexer, title, body in SNIPPETS:
        out_path = OUT / filename
        png_bytes = highlight(body, lexer, formatter)
        out_path.write_bytes(png_bytes)
        print(f"  wrote {out_path}  ({len(png_bytes)//1024} KB)")
        # Also drop a .txt sidecar for the figure caption.
        cap_path = out_path.with_suffix(".caption.txt")
        cap_path.write_text(title + "\n", encoding="utf-8")


if __name__ == "__main__":
    print(f"Rendering {len(SNIPPETS)} snippets to {OUT}\n")
    render()
    print("\nDone.")
