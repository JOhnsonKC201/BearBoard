from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from core.database import get_db
from models.notification import Notification
from models.user import User
from routers.auth import get_current_user_dep
from schemas.notification import NotificationResponse, UnreadCountResponse
from services.permissions import require_admin
from services.resurface import run_resurface

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=list[NotificationResponse])
def list_notifications(
    only_unread: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Notification)
        .options(joinedload(Notification.post))
        .filter(Notification.recipient_id == current_user.id)
    )
    if only_unread:
        query = query.filter(Notification.read.is_(False))
    return query.order_by(desc(Notification.created_at)).limit(limit).all()


@router.get("/unread_count", response_model=UnreadCountResponse)
def unread_count(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.read.is_(False),
        )
        .count()
    )
    return {"unread": count}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    notif.read = True
    db.commit()
    return {"detail": "ok"}


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    updated = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.read.is_(False),
        )
        .update({Notification.read: True}, synchronize_session=False)
    )
    db.commit()
    return {"detail": "ok", "updated": updated}


@router.post("/run-resurface")
def trigger_resurface(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Manual trigger for the resurface job. Admin-only: it fans out
    notifications to every user sharing a major with each stale post's author,
    which is a spam/DoS vector if left open."""
    return run_resurface(db)
