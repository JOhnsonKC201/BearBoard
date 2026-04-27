import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from core.database import get_db
from schemas.user import UserResponse, UserPublicResponse, UserUpdate
from models.user import User
from routers.auth import get_current_user_dep
from services.streak import bump_streak

router = APIRouter(prefix="/api/users", tags=["users"])


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
