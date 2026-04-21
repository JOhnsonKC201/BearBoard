from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.user import ROLES, User
from schemas.user import UserResponse
from services.permissions import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SetRoleRequest(BaseModel):
    email: str
    role: str


@router.get("/users", response_model=list[UserResponse])
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.name).all()


@router.post("/set-role", response_model=UserResponse)
def set_role(
    req: SetRoleRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if req.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Unknown role. Valid: {', '.join(ROLES)}")

    target = db.query(User).filter(User.email == req.email.strip()).first()
    if not target:
        raise HTTPException(status_code=404, detail=f"No user with email {req.email}")

    # Prevent an admin from demoting themselves if they're the last admin.
    if target.id == admin.id and target.role == "admin" and req.role != "admin":
        remaining_admins = (
            db.query(User).filter(User.role == "admin", User.id != admin.id).count()
        )
        if remaining_admins == 0:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    target.role = req.role
    db.commit()
    db.refresh(target)
    return target
