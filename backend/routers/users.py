from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from schemas.user import UserResponse
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


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    name: str = None,
    major: str = None,
    graduation_year: int = None,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if name is not None:
        user.name = name
    if major is not None:
        user.major = major
    if graduation_year is not None:
        user.graduation_year = graduation_year
    db.commit()
    db.refresh(user)
    return user
