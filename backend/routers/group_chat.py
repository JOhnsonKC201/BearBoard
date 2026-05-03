"""Group chat — Phase 1.

REST + WebSocket helpers for messages inside a Group. The WebSocket frames
themselves are dispatched from `routers/chat.py` (so a user holds one
socket for both DMs and group chats); the frame handlers `_handle_group_send`
and `_handle_group_edit` are imported and called from there.

Access rules:
- Only members of a group may read or post in its chat.
- Only the message's own author may edit it (mods/admins can delete via a
  future endpoint — Phase 2 scope).
- Banned users are blocked at the membership check.
- Muted users are blocked at the send check (read-only access remains).
- Edits are capped at 15 minutes since `created_at`, matching the 1-on-1
  chat contract (see chat.py:EDIT_WINDOW_SECONDS).
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, status
from pydantic import ValidationError
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from agents import moderation
from core.database import SessionLocal, get_db
from core.rate_limit import limiter
from models.group import Group
from models.group_member import GroupMember
from models.group_message import GroupMessage
from models.user import User
from routers.auth import get_current_user_dep
from schemas.group_chat import GroupMessageCreate, GroupMessageEdit, GroupMessageOut
from services.chat_manager import manager

logger = logging.getLogger("bearboard.group_chat")

router = APIRouter(prefix="/api/groups", tags=["group_chat"])

# Reuse the same edit-window constant as 1-on-1 chat so the contract is
# consistent across all message kinds in BearBoard.
EDIT_WINDOW_SECONDS = 15 * 60


# ---------------------------------------------------------------------------
# Membership helpers
# ---------------------------------------------------------------------------


def _membership(db: Session, group_id: int, user_id: int) -> Optional[GroupMember]:
    """Return the GroupMember row for (group, user) or None if not a member."""
    return (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.status == "active",
        )
        .first()
    )


def _require_membership(db: Session, group_id: int, user_id: int) -> GroupMember:
    """Membership gate. Raises 403 if the user isn't an active member of the
    group. Used by every group-chat endpoint."""
    m = _membership(db, group_id, user_id)
    if m is None:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return m


def _group_member_user_ids(db: Session, group_id: int) -> list[int]:
    """All active member user_ids for a group — used for WS fan-out."""
    rows = (
        db.query(GroupMember.user_id)
        .filter(GroupMember.group_id == group_id, GroupMember.status == "active")
        .all()
    )
    return [r[0] for r in rows]


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def _serialize(msg: GroupMessage) -> dict[str, Any]:
    """Wire shape for messages going out over WebSocket. ISO-8601 timestamps
    so the JS Date constructor parses them without extra plumbing. Author
    info is nested so the frontend can render the avatar without a second
    fetch."""
    author_payload: Optional[dict[str, Any]] = None
    if msg.author is not None:
        a = msg.author
        author_payload = {
            "id": a.id,
            "name": a.name,
            "major": getattr(a, "major", None),
            "role": getattr(a, "role", None),
            "avatar_url": getattr(a, "avatar_url", None),
        }
    created = msg.created_at or datetime.now(timezone.utc)
    return {
        "id": msg.id,
        "group_id": msg.group_id,
        "author_id": msg.author_id,
        "author": author_payload,
        "body": msg.body,
        "created_at": created.isoformat(),
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
    }


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.get("/{group_id}/messages", response_model=list[GroupMessageOut])
def get_messages(
    group_id: int,
    before: Optional[datetime] = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """History pull — paginated, oldest-first within the page so the
    frontend can append directly without reversing."""
    _require_membership(db, group_id, current_user.id)

    q = (
        db.query(GroupMessage)
        .options(joinedload(GroupMessage.author))
        .filter(GroupMessage.group_id == group_id)
    )
    if before is not None:
        q = q.filter(GroupMessage.created_at < before)
    rows = q.order_by(desc(GroupMessage.created_at)).limit(limit).all()
    return list(reversed(rows))


@router.post("/{group_id}/messages", response_model=GroupMessageOut)
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    group_id: int,
    payload: GroupMessageCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """REST send path — used as a fallback when the WS is mid-reconnect.
    Mirrors the WS handler's logic so behavior is identical either way."""
    member = _require_membership(db, group_id, current_user.id)
    if member.muted:
        raise HTTPException(status_code=403, detail="You are muted in this group")

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="empty body")

    # Block egregious content via the existing moderator (LLM with heuristic
    # fallback). flag/allow still post — only block is rejected.
    try:
        verdict = moderation.moderate(body)
        if verdict.verdict == "block":
            raise HTTPException(status_code=400, detail="Message rejected by moderation")
    except HTTPException:
        raise
    except Exception:
        logger.exception("group_chat moderation failed; allowing message through")

    msg = GroupMessage(
        group_id=group_id,
        author_id=current_user.id,
        body=body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    msg = (
        db.query(GroupMessage)
        .options(joinedload(GroupMessage.author))
        .filter(GroupMessage.id == msg.id)
        .first()
    )

    # Live fan-out to every online member.
    await _broadcast_to_group(db, group_id, {"type": "group_message", **_serialize(msg)})
    return msg


@router.patch("/{group_id}/messages/{message_id}", response_model=GroupMessageOut)
async def edit_message(
    group_id: int,
    message_id: int,
    payload: GroupMessageEdit,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Owner-only edit within the 15-minute window. Mirrors the 1-on-1
    chat edit endpoint."""
    _require_membership(db, group_id, current_user.id)

    msg = (
        db.query(GroupMessage)
        .filter(GroupMessage.id == message_id, GroupMessage.group_id == group_id)
        .first()
    )
    if msg is None:
        raise HTTPException(status_code=404, detail="message not found")
    if msg.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="not your message")

    new_body = payload.body.strip()
    if not new_body:
        raise HTTPException(status_code=400, detail="empty body")

    now = datetime.now(timezone.utc)
    created = msg.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if (now - created).total_seconds() > EDIT_WINDOW_SECONDS:
        raise HTTPException(status_code=400, detail="edit window has passed")

    msg.body = new_body
    msg.edited_at = now
    db.commit()
    db.refresh(msg)
    msg = (
        db.query(GroupMessage)
        .options(joinedload(GroupMessage.author))
        .filter(GroupMessage.id == msg.id)
        .first()
    )

    await _broadcast_to_group(
        db, group_id, {"type": "group_message_updated", **_serialize(msg)}
    )
    return msg


# ---------------------------------------------------------------------------
# Broadcast helper — used by both REST and WebSocket paths
# ---------------------------------------------------------------------------


async def _broadcast_to_group(db: Session, group_id: int, payload: dict[str, Any]) -> None:
    """Push `payload` to every online member of the group. Members who
    aren't currently connected just won't receive the live frame; they'll
    pull the message from the REST history on next page load."""
    member_ids = _group_member_user_ids(db, group_id)
    for uid in member_ids:
        await manager.send_to(uid, payload)


# ---------------------------------------------------------------------------
# WebSocket frame handlers — called from chat.py's main dispatcher
# ---------------------------------------------------------------------------


async def handle_group_send(sender_id: int, frame: dict[str, Any], ws: WebSocket) -> None:
    """WS `group_send` frame handler. Same persistence + fan-out as the
    REST send endpoint, but fires from the live socket so the sender
    doesn't pay the HTTP setup cost on every keystroke-Enter."""
    raw_gid = frame.get("group_id")
    try:
        group_id = int(raw_gid)
    except (TypeError, ValueError):
        await ws.send_json({"type": "error", "code": "bad_group_send", "detail": "invalid group_id"})
        return

    try:
        body_obj = GroupMessageCreate(body=str(frame.get("body", "")))
    except (ValidationError, TypeError, ValueError):
        await ws.send_json({"type": "error", "code": "bad_group_send", "detail": "invalid body"})
        return

    body = body_obj.body.strip()
    if not body:
        await ws.send_json({"type": "error", "code": "bad_group_send", "detail": "empty body"})
        return

    with SessionLocal() as db:
        m = _membership(db, group_id, sender_id)
        if m is None:
            await ws.send_json(
                {"type": "error", "code": "not_member", "detail": "Not a member of this group"}
            )
            return
        if m.muted:
            await ws.send_json(
                {"type": "error", "code": "muted", "detail": "You are muted in this group"}
            )
            return

        try:
            verdict = moderation.moderate(body)
            if verdict.verdict == "block":
                await ws.send_json(
                    {"type": "error", "code": "blocked", "detail": "Message blocked by moderation"}
                )
                return
        except Exception:
            logger.exception("group_chat WS moderation failed; allowing through")

        msg = GroupMessage(group_id=group_id, author_id=sender_id, body=body)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        msg = (
            db.query(GroupMessage)
            .options(joinedload(GroupMessage.author))
            .filter(GroupMessage.id == msg.id)
            .first()
        )
        wire = _serialize(msg)
        await _broadcast_to_group(db, group_id, {"type": "group_message", **wire})


async def handle_group_edit(sender_id: int, frame: dict[str, Any], ws: WebSocket) -> None:
    """WS `group_edit` frame handler. Same checks as the REST PATCH path."""
    try:
        message_id = int(frame.get("message_id"))
    except (TypeError, ValueError):
        await ws.send_json({"type": "error", "code": "bad_group_edit", "detail": "invalid message_id"})
        return

    try:
        body_obj = GroupMessageEdit(body=str(frame.get("body", "")))
    except (ValidationError, TypeError, ValueError):
        await ws.send_json({"type": "error", "code": "bad_group_edit", "detail": "invalid body"})
        return

    new_body = body_obj.body.strip()
    if not new_body:
        await ws.send_json({"type": "error", "code": "bad_group_edit", "detail": "empty body"})
        return

    with SessionLocal() as db:
        msg = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
        if msg is None:
            await ws.send_json({"type": "error", "code": "not_found", "detail": "message not found"})
            return
        if msg.author_id != sender_id:
            await ws.send_json({"type": "error", "code": "forbidden", "detail": "not your message"})
            return

        # Membership check uses the message's own group_id so a malicious
        # sender can't edit a message in a group they don't belong to even
        # if they have its message_id.
        if _membership(db, msg.group_id, sender_id) is None:
            await ws.send_json({"type": "error", "code": "not_member", "detail": "Not a member of this group"})
            return

        now = datetime.now(timezone.utc)
        created = msg.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if (now - created).total_seconds() > EDIT_WINDOW_SECONDS:
            await ws.send_json(
                {"type": "error", "code": "edit_window", "detail": "edit window has passed"}
            )
            return

        msg.body = new_body
        msg.edited_at = now
        db.commit()
        db.refresh(msg)
        msg = (
            db.query(GroupMessage)
            .options(joinedload(GroupMessage.author))
            .filter(GroupMessage.id == msg.id)
            .first()
        )
        wire = _serialize(msg)
        await _broadcast_to_group(db, msg.group_id, {"type": "group_message_updated", **wire})
