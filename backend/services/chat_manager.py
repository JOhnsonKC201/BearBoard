"""In-process registry of live WebSocket connections, keyed by user id.

Each user can have multiple sockets (laptop + phone tab + etc.), so the
value type is a `set[WebSocket]`. All mutations go through an asyncio
lock — uvicorn runs handlers concurrently on a single event loop, so
without serialisation a `disconnect` racing a `send_to` could iterate
over a mutating set.

This is an in-process singleton, which means it does NOT survive
horizontal scaling. For the demo we run a single uvicorn worker, so
that's fine. If we ever scale out we'd swap this for a Redis
pub/sub backplane; the public API of this class is shaped so that
substitution is straightforward.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import WebSocket

logger = logging.getLogger("bearboard.chat")


class ConnectionManager:
    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = {}
        # Tracks the moment the user's LAST socket dropped. Lets the UI show
        # "Active 22h ago" without a database round-trip. In-memory only —
        # cleared on uvicorn restart, which is fine for a chat-only feature.
        self._last_seen: dict[int, datetime] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> bool:
        """Register an already-accepted WebSocket. Returns True if this is
        the user's first live connection (caller can broadcast presence)."""
        async with self._lock:
            existing = self._sockets.setdefault(user_id, set())
            first = len(existing) == 0
            existing.add(websocket)
        return first

    async def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        """Unregister a WebSocket. Returns True if the user has no more
        live connections (caller can broadcast offline). Stamps last_seen
        when the user has truly gone offline."""
        async with self._lock:
            sockets = self._sockets.get(user_id)
            if not sockets:
                return False
            sockets.discard(websocket)
            if not sockets:
                self._sockets.pop(user_id, None)
                self._last_seen[user_id] = datetime.now(timezone.utc)
                return True
            return False

    async def send_to(self, user_id: int, payload: dict[str, Any]) -> int:
        """Push `payload` as JSON to every live socket the user has open.
        Returns the number of sockets that received it. Sockets that error
        out are removed.
        """
        async with self._lock:
            sockets = list(self._sockets.get(user_id, ()))
        delivered = 0
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(payload)
                delivered += 1
            except Exception:
                logger.exception("chat: send_to user_id=%s failed; reaping socket", user_id)
                dead.append(ws)
        if dead:
            async with self._lock:
                live = self._sockets.get(user_id)
                if live is not None:
                    for ws in dead:
                        live.discard(ws)
                    if not live:
                        self._sockets.pop(user_id, None)
        return delivered

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))

    def online_users(self) -> set[int]:
        return set(self._sockets.keys())

    def last_seen_at(self, user_id: int) -> Optional[datetime]:
        """Last time `user_id`'s final socket disconnected. Returns None if
        the user is online right now or has never connected since boot."""
        if self.is_online(user_id):
            return None
        return self._last_seen.get(user_id)


# Singleton instance — import this from routers/chat.py.
manager = ConnectionManager()
