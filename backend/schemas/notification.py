from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationPostInfo(BaseModel):
    """Subset of Post fields safe to surface in a notification payload.

    SECURITY NOTE: Do NOT add `author`, `author_id`, or any field that
    could identify the post's author here. Notifications go to other
    users, so anonymous posts must remain anonymous in the notification
    list. The `from_attributes` config means Pydantic reads attrs from
    the SQLAlchemy Post even though only the listed fields serialize —
    that's intentional, and the safety relies on this whitelist staying
    minimal. If you ever need richer info on the notification card,
    fetch the post detail endpoint (which already anonymizes per-viewer)
    instead of expanding this schema.
    """
    id: int
    title: str
    category: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    recipient_id: int
    post_id: Optional[int] = None
    kind: str
    read: bool
    created_at: Optional[datetime] = None
    post: Optional[NotificationPostInfo] = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread: int
