import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from core.database import get_db
from schemas.user import UserResponse, UserPublicResponse, UserUpdate
from models.user import User
from models.post import Post
from models.comment import Comment
from models.vote import Vote
from models.comment_vote import CommentVote
from models.group_member import GroupMember
from routers.auth import get_current_user_dep
from services.streak import bump_streak

router = APIRouter(prefix="/api/users", tags=["users"])


class UserStatsResponse(BaseModel):
    """Aggregated activity counts for a user's profile.

    Anonymous posts/comments are NOT counted in the totals shown to other
    viewers — surfacing a count that doesn't match the public posts list
    would silently let a curious classmate infer how many anonymous posts
    a target student has filed. The author themselves (and moderators)
    see the real total."""
    posts: int
    comments: int
    groups: int
    votes_cast: int
    upvotes_received: int
    karma: int


# Avatar uploads come in as base64 data URLs because the existing frontend
# pipeline already produces them (FileReader.readAsDataURL on the picked
# file). The cap matches the client-side budget (~1.5 MB binary becomes
# ~2 MB encoded) so we reject obvious abuse without forcing the client to
# resize first. The whitelist of image MIME types keeps SVG (XSS vector
# when served from the same origin) and arbitrary application/* payloads
# out of the column.
MAX_AVATAR_DATA_URL_BYTES = 2_200_000  # ~2.1 MB encoded
ALLOWED_AVATAR_MIMES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[a-z0-9.+/-]+);base64,(?P<payload>[A-Za-z0-9+/=]+)$",
    re.IGNORECASE,
)


class AvatarUpload(BaseModel):
    data_url: str = Field(min_length=32, max_length=MAX_AVATAR_DATA_URL_BYTES)


@router.post("/me/checkin")
def daily_checkin(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Idempotent daily check-in. Bumps the user's streak if they haven't
    already done something today."""
    result = bump_streak(db, current_user)
    db.commit()
    return result


@router.get("/{user_id}", response_model=UserPublicResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Public profile lookup. Requires auth so anonymous callers cannot
    enumerate users, and uses UserPublicResponse to withhold email/PII."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}/stats", response_model=UserStatsResponse)
def get_user_stats(
    user_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Aggregated profile activity. Counts respect the anonymity contract:
    anonymous posts/comments are excluded from public counts so a viewer
    can't infer how many anonymous items a target user has filed by
    diffing the stat against the visible posts list. The author and
    moderators see the real total."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_self_or_mod = (
        current_user.id == user_id
        or getattr(current_user, "role", None) in ("admin", "moderator")
    )

    posts_q = db.query(func.count(Post.id)).filter(Post.author_id == user_id)
    comments_q = db.query(func.count(Comment.id)).filter(Comment.author_id == user_id)
    if not is_self_or_mod:
        # Mirror the public-feed visibility rule from posts.py: hide both the
        # explicit boolean and the legacy 'anonymous' category.
        posts_q = posts_q.filter(
            Post.is_anonymous.is_(False),
            Post.category != "anonymous",
        )
        comments_q = comments_q.filter(Comment.is_anonymous.is_(False))

    posts_count = posts_q.scalar() or 0
    comments_count = comments_q.scalar() or 0

    groups_count = (
        db.query(func.count(GroupMember.id))
        .filter(GroupMember.user_id == user_id, GroupMember.status == "active")
        .scalar()
        or 0
    )

    # Votes cast: posts + comments. Counts the user's own action regardless
    # of where it landed; this is "how engaged is this user" not "what did
    # other people do to them."
    post_votes_cast = (
        db.query(func.count(Vote.id)).filter(Vote.user_id == user_id).scalar() or 0
    )
    comment_votes_cast = (
        db.query(func.count(CommentVote.id))
        .filter(CommentVote.user_id == user_id)
        .scalar()
        or 0
    )

    # Upvotes received: sum of upvote counters on the user's own posts +
    # comments. Anonymous content is excluded from public totals for the
    # same reason posts/comments are.
    post_upvotes_q = db.query(func.coalesce(func.sum(Post.upvotes), 0)).filter(
        Post.author_id == user_id
    )
    comment_upvotes_q = db.query(func.coalesce(func.sum(Comment.upvotes), 0)).filter(
        Comment.author_id == user_id
    )
    if not is_self_or_mod:
        post_upvotes_q = post_upvotes_q.filter(
            Post.is_anonymous.is_(False),
            Post.category != "anonymous",
        )
        comment_upvotes_q = comment_upvotes_q.filter(Comment.is_anonymous.is_(False))

    upvotes_received = int(post_upvotes_q.scalar() or 0) + int(
        comment_upvotes_q.scalar() or 0
    )

    return UserStatsResponse(
        posts=posts_count,
        comments=comments_count,
        groups=groups_count,
        votes_cast=post_votes_cast + comment_votes_cast,
        upvotes_received=upvotes_received,
        karma=int(getattr(user, "karma", 0) or 0),
    )


@router.post("/me/avatar", response_model=UserResponse)
def upload_avatar(
    body: AvatarUpload,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Persist a user-supplied profile photo as a base64 data URL on the
    users.avatar_url column. Validates that the payload is actually a data
    URL pointing at an allowed image MIME and rejects anything larger than
    MAX_AVATAR_DATA_URL_BYTES so a single abusive upload can't blow out
    the row size."""
    raw = (body.data_url or "").strip()
    match = _DATA_URL_RE.match(raw)
    if not match:
        raise HTTPException(status_code=400, detail="avatar must be a base64 data URL")
    mime = match.group("mime").lower()
    if mime not in ALLOWED_AVATAR_MIMES:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported image type ({mime}); allowed: {sorted(ALLOWED_AVATAR_MIMES)}",
        )
    current_user.avatar_url = raw
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserResponse)
def delete_avatar(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Clear the current user's profile photo."""
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    patch: UserUpdate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Self-only profile update. Takes a JSON body; each field is size-bounded
    via UserUpdate so an attacker cannot submit a 10 MB name."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if patch.name is not None:
        user.name = patch.name.strip()
    if patch.major is not None:
        user.major = patch.major.strip()
    if patch.graduation_year is not None:
        user.graduation_year = patch.graduation_year
    if patch.bio is not None:
        # Empty string clears the bio; anything else gets trimmed.
        user.bio = patch.bio.strip() or None
    db.commit()
    db.refresh(user)
    return user
