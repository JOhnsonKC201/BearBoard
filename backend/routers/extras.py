from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from core.database import get_db
from core.rate_limit import limiter
from schemas.post import PostResponse, EventResponse, GroupResponse, ChatRequest, ChatResponse
from pydantic import BaseModel, Field
from fastapi import HTTPException
from models.post import Post
from models.event import Event
from models.group import Group
from models.group_member import GroupMember
from models.user import User
from routers.auth import get_current_user_dep
from models.comment import Comment
from agents import chat as chat_agent
from services.morgan_events import sync_morgan_events
from services.permissions import require_admin
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api", tags=["extras"])


@router.get("/trending", response_model=list[PostResponse])
def get_trending(db: Session = Depends(get_db)):
    two_days_ago = datetime.now(timezone.utc) - timedelta(hours=48)
    posts = (
        db.query(Post)
        .options(joinedload(Post.author))
        .filter(Post.created_at >= two_days_ago)
        .order_by(desc(Post.upvotes - Post.downvotes))
        .limit(3)
        .all()
    )
    if not posts:
        posts = (
            db.query(Post)
            .options(joinedload(Post.author))
            .order_by(desc(Post.upvotes - Post.downvotes))
            .limit(3)
            .all()
        )
    return posts


@router.get("/events", response_model=list[EventResponse])
def get_events(limit: int = 8, db: Session = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    limit = max(1, min(limit, 500))
    events = (
        db.query(Event)
        .filter(Event.event_date >= today)
        .order_by(Event.event_date)
        .limit(limit)
        .all()
    )
    return events


@router.post("/events/sync")
def sync_events(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Manual trigger for the Morgan State iCal sync. Admin-only — the
    endpoint makes an outbound HTTP call, so leaving it open would invite
    SSRF / DoS abuse."""
    return sync_morgan_events(db)


from core.memocache import ttl_cache


@router.get("/stats")
@ttl_cache(ttl_seconds=15)
def public_stats(db: Session = Depends(get_db)):
    """Public pitch metrics. No auth required. Shareable in demos/decks.
    Cached for 15s — the seven aggregation queries below add up on
    Render's free tier, and nobody notices a 15s delay on a stats board."""
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_posts = db.query(func.count(Post.id)).scalar() or 0
    total_users = db.query(func.count(User.id)).filter(User.password_hash != "!pending").scalar() or 0
    total_comments = db.query(func.count(Comment.id)).scalar() or 0
    total_groups = db.query(func.count(Group.id)).scalar() or 0
    synced_events = db.query(func.count(Event.id)).filter(Event.source.isnot(None)).scalar() or 0
    posts_24h = db.query(func.count(Post.id)).filter(Post.created_at >= day_ago).scalar() or 0
    posts_7d = db.query(func.count(Post.id)).filter(Post.created_at >= week_ago).scalar() or 0
    sos_total = db.query(func.count(Post.id)).filter(Post.is_sos.is_(True)).scalar() or 0
    sos_resolved = (
        db.query(func.count(Post.id))
        .filter(Post.is_sos.is_(True), Post.sos_resolved.is_(True))
        .scalar()
        or 0
    )
    sos_resolved_pct = int(round(100 * sos_resolved / sos_total)) if sos_total else None

    return {
        "users": total_users,
        "posts": total_posts,
        "groups": total_groups,
        "comments": total_comments,
        "synced_campus_events": synced_events,
        "posts_last_24h": posts_24h,
        "posts_last_7d": posts_7d,
        "sos_posts": sos_total,
        "sos_resolved_pct": sos_resolved_pct,
    }


@router.get("/groups", response_model=list[GroupResponse])
def get_groups(
    course: str | None = None,
    db: Session = Depends(get_db),
):
    """List study groups, optionally filtered by a course code or name
    fragment ("COSC 350", "cosc350", "networking"). Case-insensitive.
    """
    q = db.query(Group)
    if course and course.strip():
        # Allow "cosc350" to match "COSC 350" by stripping spaces on both sides.
        raw = course.strip()
        compact = raw.replace(" ", "")
        like_raw = f"%{raw}%"
        like_compact = f"%{compact}%"
        q = q.filter(
            or_(
                Group.course_code.ilike(like_raw),
                Group.course_code.ilike(like_compact),
                Group.name.ilike(like_raw),
            )
        )
    return q.order_by(desc(Group.member_count)).limit(20).all()


# ---------------------------------------------------------------------------
# Group membership — create / join / leave / mine
# ---------------------------------------------------------------------------

class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    course_code: str | None = Field(default=None, max_length=20)
    description: str | None = None


@router.post("/groups", response_model=GroupResponse, status_code=201)
def create_group(
    payload: GroupCreateRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Create a new study group. The creator is auto-added as the first
    member so the Join button on the UI reads as active immediately.
    """
    group = Group(
        name=payload.name.strip(),
        course_code=(payload.course_code or "").strip() or None,
        description=(payload.description or "").strip() or None,
        created_by=current_user.id,
        member_count=1,
    )
    db.add(group)
    db.flush()  # assign group.id before creating the membership row
    db.add(GroupMember(group_id=group.id, user_id=current_user.id))
    db.commit()
    db.refresh(group)
    return group


@router.post("/groups/{group_id}/join", response_model=GroupResponse)
def join_group(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    group = db.query(Group).filter(Group.id == group_id).one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    existing = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
    ).one_or_none()
    if existing is None:
        db.add(GroupMember(group_id=group_id, user_id=current_user.id))
        group.member_count = (group.member_count or 0) + 1
        db.commit()
        db.refresh(group)
    return group


@router.delete("/groups/{group_id}/leave", response_model=GroupResponse)
def leave_group(
    group_id: int,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    group = db.query(Group).filter(Group.id == group_id).one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    existing = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
    ).one_or_none()
    if existing is not None:
        db.delete(existing)
        group.member_count = max(0, (group.member_count or 1) - 1)
        db.commit()
        db.refresh(group)
    return group


@router.get("/groups/mine", response_model=list[int])
def my_group_ids(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Return just the ids of groups the current user belongs to. The feed
    UI fetches this once and converts it to a Set so each group row can
    render a Join or Leave button without per-row requests.
    """
    rows = (
        db.query(GroupMember.group_id)
        .filter(GroupMember.user_id == current_user.id)
        .all()
    )
    return [r[0] for r in rows]


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
def chat(request: Request, req: ChatRequest):
    """Hand the message to the chat agent. The agent calls Gemini when
    GEMINI_API_KEY is set, otherwise falls back to a deterministic
    keyword router so the widget always shows something useful. We
    discard the agent's `provider` here because the public ChatResponse
    schema only carries the reply text — flip the agent call to return
    the full ChatReply if/when we want to surface 'AI' vs 'fallback'
    indicators in the UI."""
    result = chat_agent.reply(req.message or "")
    return ChatResponse(reply=result.reply)
