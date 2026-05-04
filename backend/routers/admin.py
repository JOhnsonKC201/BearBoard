from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from models.notification import Notification
from models.post import Post
from models.report import Report
from models.user import ROLES, User
from schemas.report import (
    ReportPostBrief,
    ReporterBrief,
    ReportResolve,
    ReportResponse,
)
from schemas.user import UserResponse
from services.permissions import require_admin, require_mod_or_admin

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


# ---------------------------------------------------------------------------
# Reports queue — moderator + admin
# ---------------------------------------------------------------------------


@router.get("/reports", response_model=list[ReportResponse])
def list_reports(
    status: str = Query("pending", regex="^(pending|dismissed|actioned|all)$"),
    limit: int = Query(50, ge=1, le=200),
    mod: User = Depends(require_mod_or_admin),
    db: Session = Depends(get_db),
):
    """Reports queue. Defaults to pending so the queue shows actionable
    items first; pass ?status=all to inspect history. Each row carries a
    snapshot of the reported post and the count of independent reports
    against the same post so mods can see volume at a glance."""
    q = db.query(Report).options(
        joinedload(Report.post).joinedload(Post.author),
        joinedload(Report.reporter),
    )
    if status != "all":
        q = q.filter(Report.status == status)
    rows = q.order_by(Report.created_at.desc()).limit(limit).all()

    if not rows:
        return []

    # Aggregate report counts for the posts in this page so the UI can
    # render "5 reports" without a per-row query.
    post_ids = list({r.post_id for r in rows})
    counts_rows = (
        db.query(Report.post_id, func.count(Report.id))
        .filter(Report.post_id.in_(post_ids))
        .group_by(Report.post_id)
        .all()
    )
    counts = {pid: c for pid, c in counts_rows}

    out: list[ReportResponse] = []
    for r in rows:
        p = r.post
        post_brief = None
        if p is not None:
            post_brief = ReportPostBrief(
                id=p.id,
                title=p.title or "",
                body=(p.body or "")[:1000],
                category=p.category or "",
                author_id=p.author_id,
                author_name=getattr(p.author, "name", None) if p.author else None,
                is_anonymous=bool(getattr(p, "is_anonymous", False)),
                created_at=p.created_at,
            )
        reporter_brief = None
        if r.reporter is not None:
            reporter_brief = ReporterBrief(id=r.reporter.id, name=r.reporter.name or "")
        out.append(
            ReportResponse(
                id=r.id,
                reason=r.reason,
                note=r.note,
                status=r.status,
                created_at=r.created_at,
                resolved_at=r.resolved_at,
                resolution=r.resolution,
                post=post_brief,
                reporter=reporter_brief,
                post_report_count=counts.get(r.post_id, 1),
            )
        )
    return out


@router.post("/reports/{report_id}/resolve", response_model=ReportResponse)
def resolve_report(
    report_id: int,
    payload: ReportResolve,
    mod: User = Depends(require_mod_or_admin),
    db: Session = Depends(get_db),
):
    """Mark a report as dismissed or actioned. We do NOT delete the post
    here — that's a separate explicit action via DELETE /api/posts/{id}.
    Keeps the resolution audit clean: 'dismissed' rows mean a mod looked
    and decided no action; 'actioned' rows mean a mod acted, with the
    `resolution` string spelling out what they did."""
    r = db.query(Report).filter(Report.id == report_id).first()
    if r is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if r.status != "pending":
        raise HTTPException(status_code=400, detail=f"Report is already {r.status}")

    r.status = payload.status
    r.resolved_at = datetime.now(timezone.utc)
    r.resolved_by = mod.id
    r.resolution = (payload.resolution or "").strip() or None

    # When the queue is cleared on this post, mark the related mod
    # notifications as read so the bell quiets down for everyone.
    if r.post_id is not None:
        db.query(Notification).filter(
            Notification.post_id == r.post_id,
            Notification.kind == "report",
            Notification.read.is_(False),
        ).update({Notification.read: True}, synchronize_session=False)

    db.commit()
    db.refresh(r)

    p = r.post
    post_brief = None
    if p is not None:
        post_brief = ReportPostBrief(
            id=p.id,
            title=p.title or "",
            body=(p.body or "")[:1000],
            category=p.category or "",
            author_id=p.author_id,
            author_name=getattr(p.author, "name", None) if p.author else None,
            is_anonymous=bool(getattr(p, "is_anonymous", False)),
            created_at=p.created_at,
        )
    reporter_brief = None
    if r.reporter is not None:
        reporter_brief = ReporterBrief(id=r.reporter.id, name=r.reporter.name or "")
    total = (
        db.query(func.count(Report.id)).filter(Report.post_id == r.post_id).scalar() or 1
    )
    return ReportResponse(
        id=r.id,
        reason=r.reason,
        note=r.note,
        status=r.status,
        created_at=r.created_at,
        resolved_at=r.resolved_at,
        resolution=r.resolution,
        post=post_brief,
        reporter=reporter_brief,
        post_report_count=total,
    )
