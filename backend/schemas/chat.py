from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from schemas.user import UserPublicResponse


class ChatMessageCreate(BaseModel):
    """REST body for `POST /api/chat/messages` (the WS `send` event uses the
    same shape on the wire). `body` is bounded so a runaway client can't
    push arbitrarily large frames into the DB."""

    recipient_id: int
    body: str = Field(min_length=1, max_length=4000)


class ChatMessageOut(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    body: str
    created_at: datetime
    read_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatMessageEdit(BaseModel):
    """REST body for `PATCH /api/chat/messages/{id}` and the WS `edit` event."""

    body: str = Field(min_length=1, max_length=4000)


class ConversationOut(BaseModel):
    """One row in `GET /api/chat/conversations` — the peer plus the most
    recent message and the count of messages the current user hasn't read
    yet from that peer. `peer_online` and `peer_last_seen` are populated
    from the in-memory ConnectionManager so the UI can render presence
    without a separate round-trip."""

    other_user: UserPublicResponse
    last_message: ChatMessageOut
    unread_count: int
    peer_online: bool = False
    peer_last_seen: Optional[datetime] = None


class MarkReadRequest(BaseModel):
    with_user_id: int = Field(alias="with")

    class Config:
        populate_by_name = True
