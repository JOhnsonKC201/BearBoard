from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationPostInfo(BaseModel):
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
