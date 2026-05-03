"""Schemas for group chat (Phase 1).

Wire shapes are intentionally close to `schemas/chat.py` (1-on-1 DMs) so
the frontend can reuse most of the message-rendering code. Per-group
membership / role info is exposed elsewhere via the existing
`/api/groups/{id}` endpoint and is not duplicated here.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from schemas.user import UserPublicResponse


class GroupMessageCreate(BaseModel):
    """REST body for `POST /api/groups/{id}/messages` (the WS `group_send`
    event uses the same body shape on the wire). Length cap mirrors the
    1-on-1 chat path and stops a runaway client from stuffing huge frames
    into the DB."""

    body: str = Field(min_length=1, max_length=4000)


class GroupMessageEdit(BaseModel):
    """REST body for `PATCH /api/groups/{id}/messages/{mid}` and the WS
    `group_edit` event. Same shape as ChatMessageEdit."""

    body: str = Field(min_length=1, max_length=4000)


class GroupMessageOut(BaseModel):
    id: int
    group_id: int
    author_id: Optional[int] = None
    author: Optional[UserPublicResponse] = None
    body: str
    created_at: datetime
    edited_at: Optional[datetime] = None

    class Config:
        from_attributes = True
