"""Unanswered-post resurfacing.

Picks posts older than RESURFACE_AFTER_HOURS that have zero comments and creates
a `kind='resurface'` notification for users who share the author's `major`.
The (recipient_id, post_id, kind) unique constraint stops duplicates if the job
runs again on the same post.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.comment import Comment
from models.notification import Notification
from models.post import Post
from models.user import User

RESURFACE_AFTER_HOURS = 24
RESURFACE_KIND = "resurface"


def find_relevant_recipients(db: Session, author: User) -> list[int]:
    """Users who share the author's major. Excludes the author and users without a major."""
    if not author or not author.major:
        return []
    rows = (
        db.query(User.id)
        .filter(User.id != author.id, User.major == author.major)
        .all()
    )
    return [r[0] for r in rows]


def run_resurface(db: Session | None = None) -> dict:
    """Scan for stale unanswered posts and notify relevant users.

    Returns counts for logging/monitoring.
    """
    own_session = db is None
    db = db or SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=RESURFACE_AFTER_HOURS)

        comment_counts = (
            db.query(Comment.post_id, func.count(Comment.id).label("c"))
            .group_by(Comment.post_id)
            .subquery()
        )

        stale_posts = (
            db.query(Post)
            .outerjoin(comment_counts, comment_counts.c.post_id == Post.id)
            .filter(Post.created_at <= cutoff)
            .filter(func.coalesce(comment_counts.c.c, 0) == 0)
            .all()
        )

        posts_processed = 0
        notifications_created = 0

        for post in stale_posts:
            author = db.query(User).filter(User.id == post.author_id).first()
            recipient_ids = find_relevant_recipients(db, author)
            if not recipient_ids:
                continue

            already_notified = {
                r[0]
                for r in db.query(Notification.recipient_id)
                .filter(
                    Notification.post_id == post.id,
                    Notification.kind == RESURFACE_KIND,
                )
                .all()
            }
            new_recipients = [rid for rid in recipient_ids if rid not in already_notified]
            if not new_recipients:
                continue

            for rid in new_recipients:
                db.add(
                    Notification(
                        recipient_id=rid,
                        post_id=post.id,
                        kind=RESURFACE_KIND,
                        read=False,
                    )
                )
                notifications_created += 1
            posts_processed += 1

        db.commit()
        return {
            "posts_processed": posts_processed,
            "notifications_created": notifications_created,
            "stale_posts_scanned": len(stale_posts),
        }
    finally:
        if own_session:
            db.close()
