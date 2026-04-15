from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PostCreate(BaseModel):
    title: str
    body: str
    category: str

class AuthorInfo(BaseModel):
    id: int
    name: str
    major: Optional[str] = None

    class Config:
        from_attributes = True

class CommentResponse(BaseModel):
    id: int
    body: str
    author_id: int
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
