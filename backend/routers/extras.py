from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from core.database import get_db
from schemas.post import PostResponse, EventResponse, GroupResponse, ChatRequest, ChatResponse
from models.post import Post
from models.event import Event
from models.group import Group
from models.user import User
from models.comment import Comment
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
def get_events(db: Session = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    events = (
        db.query(Event)
        .filter(Event.event_date >= today)
        .order_by(Event.event_date)
        .limit(8)
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


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Public pitch metrics. No auth required. Shareable in demos/decks."""
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_posts = db.query(func.count(Post.id)).scalar() or 0
    total_users = db.query(func.count(User.id)).filter(User.password_hash != "!pending").scalar() or 0
    total_comments = db.query(func.count(Comment.id)).scalar() or 0
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
        "comments": total_comments,
        "synced_campus_events": synced_events,
        "posts_last_24h": posts_24h,
        "posts_last_7d": posts_7d,
        "sos_posts": sos_total,
        "sos_resolved_pct": sos_resolved_pct,
    }


@router.get("/groups", response_model=list[GroupResponse])
def get_groups(db: Session = Depends(get_db)):
    groups = db.query(Group).limit(10).all()
    return groups


CANNED_RESPONSES = {
    "events": "This week:\n\n- **Yard Fest 2026** - Apr 18, Main Yard, 12-8 PM\n- **Spring Career Fair** - Apr 22, Student Center, 10 AM-3 PM\n- **Hackathon Kickoff** - Apr 25, SCMNS 201, 6 PM",
    "study group": 'Found one! **"Networking Gang"** for COSC 350 - 12 members, meets Tue/Thu on library 3rd floor. They\'re doing networking layers and socket programming.',
    "trending": "Top posts today:\n\n1. **Yard Fest Weekend Plans** - 89 upvotes\n2. **JPMorgan Internship** - 64 upvotes\n3. **Spring Career Fair** - 47 upvotes",
    "create a post": 'Hit the **"+ New Post"** button on the right side. Pick a category, write your title and body, and post.',
    "how": 'Hit the **"+ New Post"** button on the right side. Pick a category, write your title and body, and post. For events, add a date/time so it shows on the calendar.',
}


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    msg = req.message.lower()
    for key, response in CANNED_RESPONSES.items():
        if key in msg:
            return ChatResponse(reply=response)
    return ChatResponse(
        reply="Thanks for your message! Try asking about **events**, **study groups**, **trending posts**, or **how to use features**. The full AI version will be able to answer anything about campus life."
    )
