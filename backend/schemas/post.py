from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import datetime, date

class PostCreate(BaseModel):
    title: str
    body: str
    category: str
    event_date: Optional[date] = None
    event_time: Optional[str] = None

    @model_validator(mode="after")
    def _require_event_fields(self):
        if self.category and self.category.lower() in {"event", "events"}:
            if self.event_date is None:
                raise ValueError("event_date is required for Event posts")
        return self

class AuthorInfo(BaseModel):
    id: int
    name: str
    major: Optional[str] = None

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    body: str

class CommentResponse(BaseModel):
    id: int
    body: str
    author_id: int
    post_id: int
    author: Optional[AuthorInfo] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PostResponse(BaseModel):
    id: int
    title: str
    body: str
    category: str
    author_id: int
    author: Optional[AuthorInfo] = None
    upvotes: int
    downvotes: int
    event_date: Optional[date] = None
    event_time: Optional[str] = None
    comment_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PostDetailResponse(PostResponse):
    comments: list[CommentResponse] = []

class VoteRequest(BaseModel):
    vote_type: str  # "up" or "down"

class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None

    class Config:
        from_attributes = True

class GroupResponse(BaseModel):
    id: int
    name: str
    course_code: Optional[str] = None
    description: Optional[str] = None
    member_count: int

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
