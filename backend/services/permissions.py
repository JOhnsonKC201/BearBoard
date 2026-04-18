"""Role helpers and FastAPI dependencies for admin/mod gating."""
from fastapi import Depends, HTTPException

from models.user import User
from routers.auth import get_current_user_dep


def require_admin(current_user: User = Depends(get_current_user_dep)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user


def require_mod_or_admin(current_user: User = Depends(get_current_user_dep)) -> User:
    if current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Moderator or admin only")
    return current_user
