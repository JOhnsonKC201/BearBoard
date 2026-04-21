from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal, Optional
from datetime import datetime, date

# Server-side whitelist. Must match (lowercased) the categories the frontend
# surfaces; keeping it centralized here means adding a new category requires
# deliberate backend work.
ALLOWED_CATEGORIES = {
    "general", "academic", "events", "housing", "swap", "safety", "anonymous",
    # Post flairs added for the community-essentials pass. Keep slugs
    # lowercase + alphanumeric so URL params and filter chips match.
    "memes", "advice", "lostfound", "admissions",
    # legacy/backfill categories that exist in older rows:
    "recruiters", "social",
}


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10_000)
    category: str = Field(max_length=50)
    event_date: Optional[date] = None
    event_time: Optional[str] = Field(default=None, max_length=20)
    is_sos: bool = False
    price: Optional[str] = Field(default=None, max_length=40)
    contact_info: Optional[str] = Field(default=None, max_length=200)
    image_url: Optional[str] = Field(default=None, max_length=500)

    @field_validator("category")
    @classmethod
    def _check_category(cls, v: str) -> str:
        normalized = (v or "").strip().lower()
        if normalized not in ALLOWED_CATEGORIES:
            raise ValueError(
                f"Unknown category. Allowed: {', '.join(sorted(ALLOWED_CATEGORIES))}"
            )
        return normalized

    @model_validator(mode="after")
    def _require_event_fields(self):
        if self.category == "events":
            if self.event_date is None:
                raise ValueError("event_date is required for Event posts")
        return self

class AuthorInfo(BaseModel):
    id: int
    name: str
    major: Optional[str] = None
    role: str = "student"

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5_000)

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
    is_sos: bool = False
    sos_resolved: bool = False
    price: Optional[str] = None
    contact_info: Optional[str] = None
    image_url: Optional[str] = None
    comment_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PostDetailResponse(PostResponse):
    comments: list[CommentResponse] = []

class VoteRequest(BaseModel):
    vote_type: Literal["up", "down"]

class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    event_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    image_url: Optional[str] = None

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
