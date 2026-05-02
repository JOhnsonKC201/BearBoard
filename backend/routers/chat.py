"""BearChat — 1:1 real-time direct messaging.

Two surfaces share this router:

- A WebSocket at `/api/chat/ws?token=<JWT>` that handles live message
  fan-out, typing indicators, and read receipts. The `?token=` query
  param is necessary because the browser WebSocket API cannot set the
  `Authorization` header; the trade-off (token in URL → potential log
  leakage) is acceptable for this app: tokens are short-lived (24 h),
  TLS-only in production, and never logged at INFO+.
- REST endpoints under `/api/chat/...` for history, conversation
  listing, marking-read, and user search. The frontend uses these to
  render thread state on first load and after reconnects; the WS
  carries only the live deltas.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import ValidationError
from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import Session

from core.database import SessionLocal, get_db
from core.ws_auth import InvalidToken, decode_jwt_user_id
from models.chat_message import ChatMessage
from models.notification import Notification
from models.user import User
from routers.auth import get_current_user_dep
from schemas.chat import (
    ChatMessageCreate,
    ChatMessageOut,
    ConversationOut,
    MarkReadRequest,
)
from schemas.user import UserPublicResponse
from services.chat_manager import manager

logger = logging.getLogger("bearboard.chat")

router = APIRouter(prefix="/api/chat", tags=["chat"])

CHAT_NOTIFICATION_KIND = "chat"
MAX_BODY_LEN = 4000


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_message(m: ChatMessage) -> dict[str, Any]:
    """Wire shape for messages going out over WebSocket. ISO-8601 timestamps
    so the JS Date constructor parses them without extra plumbing."""
    return {
        "id": m.id,
        "from": m.sender_id,
        "to": m.recipient_id,
        "body": m.body,
        "created_at": (m.created_at or datetime.now(timezone.utc)).isoformat(),
        "read_at": m.read_at.isoformat() if m.read_at else None,
    }


def _ensure_chat_notification(db: Session, recipient_id: int, sender_id: int) -> None:
    """Increment the bell icon for an offline recipient.

    The `notifications.post_id` column has a foreign key to `posts.id`,
    so we can't reuse it to encode the chat sender. Instead, we keep at
    most one unread `kind="chat"` notification per recipient with
    `post_id=NULL`. The bell shows "you have unread DMs"; the per-thread
    unread count lives in the conversation list. The unused `sender_id`
    arg is kept so callers stay symmetric and so a future schema change
    (e.g. a `from_user_id` column) can wire it up without touching the
    call sites.
    """
    del sender_id  # not used today; see docstring
    existing = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == recipient_id,
            Notification.kind == CHAT_NOTIFICATION_KIND,
            Notification.post_id.is_(None),
            Notification.read.is_(False),
        )
        .first()
    )
    if existing:
        return
    db.add(
        Notification(
            recipient_id=recipient_id,
            post_id=None,
            kind=CHAT_NOTIFICATION_KIND,
            read=False,
        )
    )


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: Optional[str] = Query(default=None)):
    # Accept FIRST, then validate. Closing before accept would emit a 403
    # at the HTTP layer, which some browsers surface as a generic network
    # error rather than a clean close code. Accept → close(4401) gives the
    # frontend a code it can branch on.
    await websocket.accept()

    try:
        user_id = decode_jwt_user_id(token or "")
    except InvalidToken:
        await websocket.close(code=4401)
        return

    # Validate user actually exists. Done with a short-lived session so we
    # don't tie a DB connection to the lifetime of the WebSocket.
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        await websocket.close(code=4401)
        return

    is_first = await manager.connect(user_id, websocket)
    if is_first:
        # Tell every other live user this one just came online. Cheap
        # broadcast: the manager only has people who actually care.
        for peer_id in manager.online_users():
            if peer_id != user_id:
                await manager.send_to(
                    peer_id, {"type": "presence", "user_id": user_id, "online": True}
                )

    # Send a hello frame so the client can populate its `online_users`
    # cache without a separate HTTP roundtrip.
    await websocket.send_json(
        {
            "type": "hello",
            "user_id": user_id,
            "online_users": sorted(uid for uid in manager.online_users() if uid != user_id),
        }
    )

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                await _handle_inbound(user_id, raw, websocket)
            except WebSocketDisconnect:
                # Re-raise so the outer handler can do cleanup once.
                raise
            except Exception as exc:
                # One bad frame should NOT tear down the whole socket — just
                # tell the client and keep the loop alive.
                logger.exception("chat ws: handler error for user_id=%s", user_id)
                try:
                    await websocket.send_json({
                        "type": "error",
                        "code": "handler_error",
                        "detail": str(exc)[:200],
                    })
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("chat ws: unexpected error for user_id=%s", user_id)
    finally:
        was_last = await manager.disconnect(user_id, websocket)
        if was_last:
            ls = manager.last_seen_at(user_id)
            payload = {
                "type": "presence",
                "user_id": user_id,
                "online": False,
                "last_seen": ls.isoformat() if ls else None,
            }
            for peer_id in manager.online_users():
                await manager.send_to(peer_id, payload)


async def _handle_inbound(sender_id: int, frame: dict[str, Any], ws: WebSocket) -> None:
    """Dispatch one decoded frame from `sender_id`."""
    if not isinstance(frame, dict):
        await ws.send_json({"type": "error", "code": "bad_frame", "detail": "expected object"})
        return
    kind = frame.get("type")

    if kind == "ping":
        await ws.send_json({"type": "pong"})
        return

    if kind == "send":
        await _handle_send(sender_id, frame, ws)
        return

    if kind == "typing":
        peer = frame.get("to")
        if isinstance(peer, int) and peer != sender_id:
            await manager.send_to(peer, {"type": "typing", "from": sender_id})
        return

    if kind == "read":
        peer = frame.get("with")
        if isinstance(peer, int) and peer != sender_id:
            await _handle_read(sender_id, peer)
        return

    await ws.send_json({"type": "error", "code": "unknown_type", "detail": str(kind)})


async def _handle_send(sender_id: int, frame: dict[str, Any], ws: WebSocket) -> None:
    try:
        payload = ChatMessageCreate(
            recipient_id=int(frame.get("to")),
            body=str(frame.get("body", "")),
        )
    except (ValidationError, TypeError, ValueError):
        await ws.send_json({"type": "error", "code": "bad_send", "detail": "invalid send frame"})
        return

    if payload.recipient_id == sender_id:
        await ws.send_json({"type": "error", "code": "self_send", "detail": "cannot DM yourself"})
        return

    with SessionLocal() as db:
        recipient = db.query(User).filter(User.id == payload.recipient_id).first()
        if recipient is None:
            await ws.send_json(
                {"type": "error", "code": "no_recipient", "detail": "user not found"}
            )
            return

        msg = ChatMessage(
            sender_id=sender_id,
            recipient_id=payload.recipient_id,
            body=payload.body.strip(),
        )
        db.add(msg)

        # If recipient is offline, increment their notification counter.
        # We do this inside the same transaction so we either persist both
        # the message and the notification, or neither.
        if not manager.is_online(payload.recipient_id):
            _ensure_chat_notification(db, payload.recipient_id, sender_id)

        db.commit()
        db.refresh(msg)
        wire = _serialize_message(msg)

    out = {"type": "message", **wire}
    # Echo to sender (all their devices) and push to recipient.
    await manager.send_to(sender_id, out)
    await manager.send_to(payload.recipient_id, out)


async def _handle_read(reader_id: int, peer_id: int) -> None:
    """Mark messages from `peer_id` to `reader_id` as read, then notify
    the peer so their UI can flip the 'seen' indicator."""
    now = datetime.now(timezone.utc)
    up_to_id: Optional[int] = None
    with SessionLocal() as db:
        latest = (
            db.query(ChatMessage.id)
            .filter(
                ChatMessage.sender_id == peer_id,
                ChatMessage.recipient_id == reader_id,
                ChatMessage.read_at.is_(None),
            )
            .order_by(desc(ChatMessage.id))
            .limit(1)
            .scalar()
        )
        if latest is None:
            return
        up_to_id = latest
        db.query(ChatMessage).filter(
            ChatMessage.sender_id == peer_id,
            ChatMessage.recipient_id == reader_id,
            ChatMessage.read_at.is_(None),
        ).update({ChatMessage.read_at: now}, synchronize_session=False)

        # Also clear unread chat notifications for the reader so the bell
        # doesn't keep showing an alert while they're actively in the app.
        # We clear all (rather than per-peer) because the row doesn't carry
        # which peer triggered it; over-clearing is fine since the user is
        # reading chat right now.
        db.query(Notification).filter(
            Notification.recipient_id == reader_id,
            Notification.kind == CHAT_NOTIFICATION_KIND,
            Notification.read.is_(False),
        ).update({Notification.read: True}, synchronize_session=False)
        db.commit()

    await manager.send_to(
        peer_id, {"type": "read", "by": reader_id, "up_to_id": up_to_id}
    )


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """One row per peer, ordered by the most-recent message desc.

    Implementation note: we do this in two queries rather than a single
    window-function query so the same code runs against SQLite (used in
    tests + local dev) and Postgres (Neon, production). The N here is the
    number of distinct chat partners for the current user, which stays
    small in practice.
    """
    me = current_user.id

    pair_expr = func.min(ChatMessage.id).label("anchor")  # any message id in the pair
    subq = (
        db.query(
            func.max(ChatMessage.id).label("last_id"),
            # The "other" user id: the one that isn't `me`.
            func.max(
                func.coalesce(
                    func.nullif(ChatMessage.sender_id, me),
                    ChatMessage.recipient_id,
                )
            ).label("peer_id"),
        )
        .filter(
            or_(ChatMessage.sender_id == me, ChatMessage.recipient_id == me),
        )
        .group_by(
            # GROUP BY the unordered pair {me, other}. Since `me` is fixed,
            # grouping by (sender_id + recipient_id - me) gives the peer.
            (ChatMessage.sender_id + ChatMessage.recipient_id) - me
        )
        .subquery()
    )

    rows = (
        db.query(ChatMessage, subq.c.peer_id)
        .join(subq, ChatMessage.id == subq.c.last_id)
        .order_by(desc(ChatMessage.created_at))
        .all()
    )

    if not rows:
        return []

    peer_ids = {peer_id for _, peer_id in rows}
    users = {
        u.id: u for u in db.query(User).filter(User.id.in_(peer_ids)).all()
    }

    # Unread counts per peer.
    unread_rows = (
        db.query(ChatMessage.sender_id, func.count(ChatMessage.id))
        .filter(
            ChatMessage.recipient_id == me,
            ChatMessage.read_at.is_(None),
            ChatMessage.sender_id.in_(peer_ids),
        )
        .group_by(ChatMessage.sender_id)
        .all()
    )
    unread = dict(unread_rows)

    out: list[ConversationOut] = []
    for last_msg, peer_id in rows:
        peer = users.get(peer_id)
        if peer is None:
            continue
        out.append(
            ConversationOut(
                other_user=UserPublicResponse.model_validate(peer),
                last_message=ChatMessageOut.model_validate(last_msg),
                unread_count=int(unread.get(peer_id, 0)),
                peer_online=manager.is_online(peer_id),
                peer_last_seen=manager.last_seen_at(peer_id),
            )
        )
    return out


@router.get("/messages", response_model=list[ChatMessageOut])
def get_messages(
    with_user: int = Query(..., alias="with", description="The other user's id"),
    before: Optional[datetime] = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    if with_user == current_user.id:
        raise HTTPException(status_code=400, detail="cannot fetch self-thread")
    me = current_user.id

    q = db.query(ChatMessage).filter(
        or_(
            and_(ChatMessage.sender_id == me, ChatMessage.recipient_id == with_user),
            and_(ChatMessage.sender_id == with_user, ChatMessage.recipient_id == me),
        )
    )
    if before is not None:
        q = q.filter(ChatMessage.created_at < before)
    rows = q.order_by(desc(ChatMessage.created_at)).limit(limit).all()
    # Return oldest-first so the frontend can append directly to its
    # message list without reversing.
    return list(reversed(rows))


@router.post("/messages/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    body: MarkReadRequest,
    current_user: User = Depends(get_current_user_dep),
):
    """REST counterpart to the WS `read` event. Same effect; useful when
    the WS is mid-reconnect and we want to ack reads anyway."""
    if body.with_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot mark self-thread")
    await _handle_read(current_user.id, body.with_user_id)


@router.get("/users/search", response_model=list[UserPublicResponse])
def search_users(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Typeahead for the 'New chat' modal.

    Matching rules (case-insensitive everywhere):
      - Single word like "john": matches anywhere in name or email. So
        "john" finds "Johnson", "Joshua John", and "john@morgan.edu".
      - Multi-word like "johnson kc": every word must appear in EITHER
        name or email. Order doesn't matter. So "kc johnson" matches the
        same row.
      - Excludes the current user from results.
      - Excludes pre-provisioned (no-password) accounts so admin-staged
        rows don't show up before a real student claims them.
      - Returns a clean public profile (UserPublicResponse strips email).
    """
    raw = q.strip()
    if not raw:
        return []

    # Split on whitespace; cap to 5 terms so a runaway query can't
    # explode into a giant SQL filter chain.
    terms = [t for t in raw.split() if t][:5]
    if not terms:
        return []

    query = db.query(User).filter(
        User.id != current_user.id,
        User.password_hash != "!pending",
    )
    for term in terms:
        needle = f"%{term}%"
        query = query.filter(or_(User.name.ilike(needle), User.email.ilike(needle)))
    rows = query.order_by(User.name.asc()).limit(limit).all()
    return rows


@router.get("/presence")
def get_presence(
    current_user: User = Depends(get_current_user_dep),  # noqa: ARG001 (auth gate)
):
    """Snapshot of who's online right now. The WS hello frame carries the
    same data; this endpoint is here for the case where the page renders
    a conversation list before the WS has connected."""
    return {"online_user_ids": sorted(manager.online_users())}
