"""Schemas for group chat (Phase 1).

Wire shapes are intentionally close to `schemas/chat.py` (1-on-1 DMs) so
the frontend can reuse most of the message-rendering code. Per-group
membership / role info is exposed elsewhere via the existing
`/api/groups/{id}` endpoint and is not duplicated here.
"""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# Reuse the SSRF/scheme guard from posts so attachment URLs go through the
# same allow-list (no javascript:, no private IPs, no metadata endpoints).
# Lateral schema import is fine for a single-purpose helper; if more callers
# want this, lift to core/url_validation.py.
from schemas.post import _validate_public_image_url
from schemas.user import UserPublicResponse


# Allowed attachment classifications. Drives client-side rendering: 'image'
# inlines as a thumbnail, the rest render as a download chip with the
# original filename. Stored as a small string column so adding new kinds
# (e.g. 'video') doesn't require a migration.
AttachmentKind = Literal["image", "pdf", "doc", "other"]


class GroupMessageCreate(BaseModel):
    """REST body for `POST /api/groups/{id}/messages` (the WS `group_send`
    event uses the same body shape on the wire). Either `body` (text) or
    `attachment_url` (file) must be set — empty messages are rejected by
    the model_validator below.

    Length caps mirror the 1-on-1 chat path; min_length is 0 because an
    attachment-only message has empty body."""

    body: str = Field(default="", max_length=4000)
    attachment_url: Optional[str] = Field(default=None, max_length=500)
    attachment_name: Optional[str] = Field(default=None, max_length=200)
    attachment_kind: Optional[AttachmentKind] = None

    @field_validator("attachment_url")
    @classmethod
    def _check_attachment_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_public_image_url(v)

    @model_validator(mode="after")
    def _require_text_or_attachment(self):
        # Strip whitespace before checking so " " doesn't pass as text.
        body_present = bool((self.body or "").strip())
        attachment_present = bool(self.attachment_url)
        if not body_present and not attachment_present:
            raise ValueError("Message must include text or an attachment")
        # If attachment_url is set, attachment_kind defaults to 'other' so
        # the client always has a renderable kind even when the uploader
        # forgot to send one. attachment_name falls back to the URL's
        # tail component so the chip never reads "Untitled file."
        if attachment_present and not self.attachment_kind:
            self.attachment_kind = "other"
        return self


class GroupMessageEdit(BaseModel):
    """REST body for `PATCH /api/groups/{id}/messages/{mid}` and the WS
    `group_edit` event. Edits only change text — the attachment is
    locked once the message is sent (matches Slack/Discord). To change
    an attachment, the user re-sends a new message and deletes the old
    one (delete is Phase 2 scope)."""

    body: str = Field(min_length=1, max_length=4000)


class GroupMessageOut(BaseModel):
    id: int
    group_id: int
    author_id: Optional[int] = None
    author: Optional[UserPublicResponse] = None
    body: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_kind: Optional[AttachmentKind] = None
    created_at: datetime
    edited_at: Optional[datetime] = None

    class Config:
        from_attributes = True
