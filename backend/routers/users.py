from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from schemas.user import UserResponse, UserPublicResponse, UserUpdate
from models.user import User
from routers.auth import get_current_user_dep
from services.streak import bump_streak

router = APIRouter(prefix="/api/users", tags=["users"])


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
