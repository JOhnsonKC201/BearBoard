from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from core.database import get_db
from schemas.post import PostResponse, EventResponse, GroupResponse, ChatRequest, ChatResponse
from models.post import Post
from models.event import Event
from models.group import Group
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
    events = (
        db.query(Event)
        .order_by(Event.event_date)
        .limit(5)
        .all()
    )
    return events


@router.get("/groups", response_model=list[GroupResponse])
def get_groups(db: Session = Depends(get_db)):
    groups = db.query(Group).limit(10).all()
    return groups


CANNED_RESPONSES = {
    "events": "This week:\n\n- **Yard Fest 2026** — Apr 18, Main Yard, 12-8 PM\n- **Spring Career Fair** — Apr 22, Student Center, 10 AM-3 PM\n- **Hackathon Kickoff** — Apr 25, SCMNS 201, 6 PM",
    "study group": 'Found one! **"Networking Gang"** for COSC 350 — 12 members, meets Tue/Thu on library 3rd floor. They\'re doing networking layers and socket programming.',
    "trending": "Top posts today:\n\n1. **Yard Fest Weekend Plans** — 89 upvotes\n2. **JPMorgan Internship** — 64 upvotes\n3. **Spring Career Fair** — 47 upvotes",
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
