"""Leaderboard router.

One endpoint, multiple rankings. Returning all boards in a single payload
keeps the leaderboard page snappy on Render's free tier where every cold
round-trip is expensive. Each ranking is capped at `limit` (default 10)
so the response is bounded regardless of how the community grows.

Rankings:
- top_posters    — users with the most posts
- longest_streak — users with the highest current activity streak
- top_karma      — users with the highest karma (from the User.karma column,
                   maintained elsewhere: upvotes minus downvotes across posts)
- top_helpful    — users whose posts have the highest cumulative upvotes
                   (a "helpfulness" proxy that rewards quality, not volume)
- most_active    — composite: posts + comments authored (overall contribution)

Anonymous-category posts/comments are excluded from author attribution so
we don't leak whose anonymous content got upvoted. Posts authored by
moderator/admin accounts still count — same rules for everyone.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case, Integer
from sqlalchemy.orm import Session

from core.database import get_db
from core.memocache import ttl_cache
from models.user import User
from models.post import Post
from models.comment import Comment
from models.vote import Vote


router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


def _user_card(user: User) -> dict:
    """Minimal public snapshot used across every board. Excludes email
    and any other PII so leaderboards are safe for logged-out viewing if
    the auth gate is later relaxed."""
    return {
        "id": user.id,
        "name": user.name,
        "major": user.major,
        "graduation_year": user.graduation_year,
        "role": getattr(user, "role", "student") or "student",
        "streak_count": user.streak_count or 0,
    }


@router.get("")
@ttl_cache(ttl_seconds=60)
def get_leaderboard(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    # Cached for 60s keyed by `limit` — five aggregation subqueries per
    # call, and rankings shifting minute-by-minute isn't useful.
    # Collect everyone we'll render so we can bulk-fetch the User rows once.
    # Each sub-query returns (user_id, metric_value); we deduplicate at the end.

    # Non-anonymous filter for post-related boards. Keeps the leaderboard
    # from attributing secrets to their authors even indirectly.
    non_anon = Post.category != "anonymous"

    # ---- Most posts ------------------------------------------------------
    posts_q = (
        db.query(Post.author_id, func.count(Post.id).label("metric"))
        .filter(non_anon)
        .group_by(Post.author_id)
        .order_by(func.count(Post.id).desc())
        .limit(limit)
        .all()
    )

    # ---- Longest streak --------------------------------------------------
    streak_q = (
        db.query(User)
        .filter(User.streak_count.isnot(None), User.streak_count > 0)
        .order_by(User.streak_count.desc(), User.name.asc())
        .limit(limit)
        .all()
    )

    # ---- Top karma -------------------------------------------------------
    karma_q = (
        db.query(User)
        .filter(User.karma.isnot(None))
        .order_by(User.karma.desc(), User.name.asc())
        .limit(limit)
        .all()
    )

    # ---- Most helpful: cumulative (upvotes - downvotes) across posts -----
    helpful_q = (
        db.query(
            Post.author_id,
            func.sum(Post.upvotes - Post.downvotes).label("metric"),
        )
        .filter(non_anon)
        .group_by(Post.author_id)
        .order_by(func.sum(Post.upvotes - Post.downvotes).desc())
        .limit(limit)
        .all()
    )

    # ---- Most active: posts + comments (non-anonymous only) ---------------
    posts_per_user = (
        db.query(Post.author_id.label("uid"), func.count(Post.id).label("pc"))
        .filter(non_anon)
        .group_by(Post.author_id)
        .subquery()
    )
    comments_per_user = (
        db.query(Comment.author_id.label("uid"), func.count(Comment.id).label("cc"))
        .group_by(Comment.author_id)
        .subquery()
    )
    # Outer-join both subqueries against Users so a user with only comments
    # (no posts) still shows up, and vice versa.
    active_q = (
        db.query(
            User.id,
            (func.coalesce(posts_per_user.c.pc, 0)
             + func.coalesce(comments_per_user.c.cc, 0)).label("metric"),
        )
        .outerjoin(posts_per_user, posts_per_user.c.uid == User.id)
        .outerjoin(comments_per_user, comments_per_user.c.uid == User.id)
        .order_by(
            (func.coalesce(posts_per_user.c.pc, 0)
             + func.coalesce(comments_per_user.c.cc, 0)).desc(),
            User.name.asc(),
        )
        .limit(limit)
        .all()
    )

    # Bulk-hydrate User rows for any id that appeared in a board-by-id list.
    id_set = set()
    for rows in (posts_q, helpful_q, active_q):
        for row in rows:
            if row[0] is not None:
                id_set.add(row[0])
    for u in streak_q + karma_q:
        id_set.add(u.id)
    users_by_id = {
        u.id: u
        for u in (db.query(User).filter(User.id.in_(id_set)).all() if id_set else [])
    }

    def _rows_by_id(rows, metric_name: str):
        out = []
        for user_id, metric in rows:
            u = users_by_id.get(user_id)
            if not u or not metric:
                continue
            out.append({
                **_user_card(u),
                metric_name: int(metric),
            })
        return out

    def _rows_by_user(rows, metric_name: str, attr: str):
        out = []
        for u in rows:
            val = getattr(u, attr, None)
            if val is None:
                continue
            out.append({
                **_user_card(u),
                metric_name: int(val),
            })
        return out

    return {
        "top_posters":    _rows_by_id(posts_q, "post_count"),
        "longest_streak": _rows_by_user(streak_q, "streak_count", "streak_count"),
        "top_karma":      _rows_by_user(karma_q, "karma", "karma"),
        "top_helpful":    _rows_by_id(helpful_q, "net_upvotes"),
        "most_active":    _rows_by_id(active_q, "contribution_count"),
    }
