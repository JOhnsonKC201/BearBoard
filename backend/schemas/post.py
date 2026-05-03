from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal, Optional
from datetime import datetime, date
from urllib.parse import urlparse
from ipaddress import ip_address

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


def _validate_public_image_url(raw: Optional[str]) -> Optional[str]:
    """Constrain user-supplied image URLs so they can't be abused for SSRF,
    javascript:-protocol XSS, or cloud-metadata exfiltration.

    Returns the normalized URL (or None) or raises ValueError if unsafe.
    """
    if not raw:
        return None
    url = raw.strip()
    if not url:
        return None
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in {"http", "https"}:
        raise ValueError("image_url must start with http:// or https://")
    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("image_url is missing a hostname")
    # Block direct-IP addresses that point to private, loopback, link-local,
    # or reserved ranges (AWS/GCP metadata service lives at 169.254.169.254).
    try:
        ip = ip_address(host)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError("image_url cannot point to a non-public address")
    except ValueError as e:
        # `ip_address` raises ValueError for non-IP hostnames, which is what
        # we want to allow through. Re-raise only if the message is ours.
        if "non-public" in str(e):
            raise
    # Block well-known local hostnames too (hostname-based bypass of the
    # IP check above).
    if host in {"localhost", "ip6-localhost", "ip6-loopback"}:
        raise ValueError("image_url cannot point to a non-public address")
    return url


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10_000)
    category: str = Field(max_length=50)
    event_date: Optional[date] = None
    event_time: Optional[str] = Field(default=None, max_length=20)
    is_sos: bool = False
    # Toggle on the post composer. When true, the API strips author identity
    # from responses (DB still retains author_id for moderation). Decoupled
    # from `category` so any flair can be posted anonymously.
    is_anonymous: bool = False
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

    @field_validator("image_url")
    @classmethod
    def _check_image_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_public_image_url(v)

    @model_validator(mode="after")
    def _require_event_fields(self):
        if self.category == "events":
            if self.event_date is None:
                raise ValueError("event_date is required for Event posts")
        return self

class PostUpdate(BaseModel):
    """Fields an author can edit on a post they already published. All
    optional so the client can PATCH only what changed. Category edits
    are disallowed because changing a post's flair mid-flight confuses
    filters and notifications; if that's wrong, lift the restriction
    here and re-test the resurface + SOS pipelines."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    body: Optional[str] = Field(default=None, min_length=1, max_length=10_000)
    image_url: Optional[str] = Field(default=None, max_length=500)

    @field_validator("image_url")
    @classmethod
    def _check_image_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_public_image_url(v)


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=5_000)


class AuthorInfo(BaseModel):
    id: int
    name: str
    major: Optional[str] = None
    role: str = "student"
    # Inline base64 data URL or empty string. Surfaces on every post/comment
    # so author chips across the site (feed, detail page, comments, navbar)
    # can render the real photo instead of falling back to initials.
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5_000)
    # Optional: when set, this comment is a reply to another comment under
    # the same post. The route enforces depth-1 (parents must be top-level)
    # so replies-of-replies flatten under the original parent.
    parent_id: Optional[int] = None
    # Toggle on the comment composer; same semantics as PostCreate.is_anonymous.
    # Per-action — does NOT carry over to the user's next comment.
    is_anonymous: bool = False

class CommentResponse(BaseModel):
    id: int
    body: str
    # author_id is Optional so routes can null-it-out for anonymous comments
    # before serialization. The DB column itself stays NOT NULL; this only
    # controls what leaves the API.
    author_id: Optional[int] = None
    post_id: int
    parent_id: Optional[int] = None
    upvotes: int = 0
    downvotes: int = 0
    is_anonymous: bool = False
    author: Optional[AuthorInfo] = None
    created_at: Optional[datetime] = None
    # The current viewer's vote on this comment, or None if they haven't
    # voted (or aren't authenticated). Populated by the route handler via a
    # batch query so the frontend can render the correct active arrow on
    # page load — without this, the UI defaulted to "neutral" for every
    # comment after a re-login, masking the backend's existing dedup.
    user_vote: Optional[Literal["up", "down"]] = None

    class Config:
        from_attributes = True

class PostResponse(BaseModel):
    id: int
    title: str
    body: str
    category: str
    # author_id is Optional so routes can null-it-out for anonymous posts
    # before serialization. The DB column itself stays NOT NULL; this only
    # controls what leaves the API.
    author_id: Optional[int] = None
    author: Optional[AuthorInfo] = None
    upvotes: int
    downvotes: int
    event_date: Optional[date] = None
    event_time: Optional[str] = None
    is_sos: bool = False
    sos_resolved: bool = False
    is_anonymous: bool = False
    price: Optional[str] = None
    contact_info: Optional[str] = None
    image_url: Optional[str] = None
    comment_count: int = 0
    created_at: Optional[datetime] = None
    # The current viewer's vote on this post — same purpose as
    # CommentResponse.user_vote. See its docstring.
    user_vote: Optional[Literal["up", "down"]] = None

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
