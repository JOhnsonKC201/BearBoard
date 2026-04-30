"""Global search endpoint.

Single round-trip that hits every searchable resource (users, posts,
groups, events, professors) and returns grouped results. Designed for
the navbar's `?q=...` flow — the frontend hits this once and renders
five sections.

Design choices:

- **Auth required.** The detail-rich payloads (user names, majors,
  professor course codes) shouldn't be scrapeable. We rate-limit per
  user too.
- **Anonymity contract preserved.** Anonymous posts are excluded from
  results unless the viewer is the author or a moderator (same rule
  the feed uses). Author identity is stripped from any anonymous post
  that does show up — defense in depth.
- **Capped per category.** 10 hits each. We're not building infinite
  scroll on a search page; if the user wants more they'll filter.
- **LIKE-safe.** User input is escaped via `like_escape` so a query of
  `%` doesn't match every row (the same protection added in PR #73).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import Integer, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.db_text import like_escape
from core.rate_limit import limiter
from models.comment import Comment
from models.event import Event
from models.group import Group
from models.post import Post
from models.professor import Professor, ProfessorRating
from models.user import User
from routers.auth import get_current_user_dep

logger = logging.getLogger("bearboard.search")

router = APIRouter(prefix="/api/search", tags=["search"])

# Per-category cap. Tuned to "looks full but not noisy" — five sections
# at 10 each fits a comfortable scrolling page.
PER_CATEGORY_LIMIT = 10
# Hard floor on the query length so a single character doesn't full-table-
# scan every model. Two chars catches "AI", "JS", "K", "Dr", etc.
MIN_QUERY_LEN = 2


@router.get("")
@limiter.limit("30/minute")
def search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=80),
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Search across users, posts, groups, events, and professors.

    Returns five named arrays. Each capped at PER_CATEGORY_LIMIT. The
    `total_results` field is the sum across categories so the frontend
    can render an "X results" line without looping the dict.
    """
    needle = (q or "").strip()
    if len(needle) < MIN_QUERY_LEN:
        return _empty_response(needle)

    is_mod = current_user.role in ("admin", "moderator")
    pattern = f"%{like_escape(needle.lower())}%"

    users = _search_users(db, pattern)
    groups = _search_groups(db, pattern)
    events = _search_events(db, pattern)
    professors = _search_professors(db, pattern)
    posts = _search_posts(db, pattern, viewer=current_user, viewer_is_mod=is_mod)

    total = len(users) + len(groups) + len(events) + len(professors) + len(posts)
    logger.info("search q=%r user=%s total=%d", needle[:40], current_user.id, total)

    return {
        "query": needle,
        "total_results": total,
        "users": users,
        "groups": groups,
        "events": events,
        "professors": professors,
        "posts": posts,
    }


def _empty_response(q: str) -> dict:
    return {
        "query": q,
        "total_results": 0,
        "users": [],
        "groups": [],
        "events": [],
        "professors": [],
        "posts": [],
    }


def _search_users(db: Session, pattern: str) -> list[dict]:
    """Match name + major. Email is intentionally NOT searched — we
    don't want to enable email-discovery via the search box."""
    rows = (
        db.query(User)
        .filter(
            or_(
                func.lower(User.name).like(pattern, escape="\\"),
                func.lower(User.major).like(pattern, escape="\\"),
            )
        )
        .filter(User.password_hash != "!pending")  # exclude un-claimed pre-provisioned rows
        .order_by(User.name.asc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    return [
        {
            "id": u.id,
            "name": u.name,
            "major": u.major,
            "graduation_year": u.graduation_year,
            "role": getattr(u, "role", "student") or "student",
            "avatar_url": getattr(u, "avatar_url", None),
        }
        for u in rows
    ]


def _search_groups(db: Session, pattern: str) -> list[dict]:
    """Match name + course_code + description. Private groups are
    excluded — they're invite-only and shouldn't appear in browse."""
    rows = (
        db.query(Group)
        .filter(Group.is_private.is_(False))
        .filter(
            or_(
                func.lower(Group.name).like(pattern, escape="\\"),
                func.lower(Group.course_code).like(pattern, escape="\\"),
                func.lower(Group.description).like(pattern, escape="\\"),
            )
        )
        .order_by(Group.member_count.desc().nullslast(), Group.name.asc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    return [
        {
            "id": g.id,
            "name": g.name,
            "course_code": g.course_code,
            "description": (g.description or "")[:160],
            "member_count": g.member_count or 0,
        }
        for g in rows
    ]


def _search_events(db: Session, pattern: str) -> list[dict]:
    """Match title + location + description. Future events first, then
    past — so a search for 'fair' surfaces the upcoming career fair before
    last year's archived one."""
    today = func.current_date()
    rows = (
        db.query(Event)
        .filter(
            or_(
                func.lower(Event.title).like(pattern, escape="\\"),
                func.lower(Event.location).like(pattern, escape="\\"),
                func.lower(Event.description).like(pattern, escape="\\"),
            )
        )
        .order_by(
            (Event.event_date >= today).desc(),
            Event.event_date.asc(),
        )
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    return [
        {
            "id": e.id,
            "title": e.title,
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "start_time": e.start_time,
            "location": e.location,
            "source_url": e.source_url,
        }
        for e in rows
    ]


def _search_professors(db: Session, pattern: str) -> list[dict]:
    """Match name + department, plus any course_code that's been used
    in a rating against the professor (so 'COSC 350' surfaces every
    prof ever reviewed for that class)."""
    via_course = (
        db.query(ProfessorRating.professor_id)
        .filter(func.lower(ProfessorRating.course_code).like(pattern, escape="\\"))
        .distinct()
    )
    rows = (
        db.query(Professor)
        .filter(
            or_(
                func.lower(Professor.name).like(pattern, escape="\\"),
                func.lower(Professor.department).like(pattern, escape="\\"),
                Professor.id.in_(via_course),
            )
        )
        .order_by(Professor.name.asc())
        .limit(PER_CATEGORY_LIMIT)
        .all()
    )
    if not rows:
        return []

    # Aggregate counts in one query so we can show "X reviews" inline.
    prof_ids = [p.id for p in rows]
    aggs = dict(
        db.query(
            ProfessorRating.professor_id,
            func.count(ProfessorRating.id),
            func.avg(ProfessorRating.rating),
        )
        .filter(ProfessorRating.professor_id.in_(prof_ids))
        .group_by(ProfessorRating.professor_id)
        .all()
    )
    # Reshape: dict (still by id) of (count, avg)
    agg_lookup = {k: v for k, v in aggs.items()}  # already keyed by id
    out = []
    for p in rows:
        count_avg = (
            db.query(
                func.count(ProfessorRating.id),
                func.avg(ProfessorRating.rating),
            )
            .filter(ProfessorRating.professor_id == p.id)
            .first()
        )
        cnt = int(count_avg[0] or 0)
        avg = float(round(count_avg[1], 2)) if count_avg[1] is not None else None
        out.append({
            "id": p.id,
            "name": p.name,
            "department": p.department,
            "rating_count": cnt,
            "avg_rating": avg,
        })
    return out


def _search_posts(db: Session, pattern: str, viewer: User, viewer_is_mod: bool) -> list[dict]:
    """Match title + body. Anonymous posts are excluded unless the
    viewer is the post's author or a mod — same rule as the feed.
    Author identity is stripped from any anon post that survives the
    filter (defense in depth in case the filter ever drifts)."""
    q = (
        db.query(Post)
        .options(joinedload(Post.author))
        .filter(
            or_(
                func.lower(Post.title).like(pattern, escape="\\"),
                func.lower(Post.body).like(pattern, escape="\\"),
            )
        )
    )
    if not viewer_is_mod:
        # Hide anonymous posts unless viewer is the author.
        q = q.filter(
            or_(
                Post.is_anonymous.is_(False),
                Post.author_id == viewer.id,
            )
        ).filter(Post.category != "anonymous")
    rows = q.order_by(Post.created_at.desc()).limit(PER_CATEGORY_LIMIT).all()

    out = []
    for p in rows:
        anon = bool(getattr(p, "is_anonymous", False)) or (p.category or "").lower() == "anonymous"
        author_payload = None
        if not anon or viewer_is_mod or (viewer and p.author_id == viewer.id):
            if p.author:
                author_payload = {
                    "id": p.author.id,
                    "name": p.author.name,
                    "major": p.author.major,
                    "role": getattr(p.author, "role", "student") or "student",
                    "avatar_url": getattr(p.author, "avatar_url", None),
                }
        # Body preview: first 200 chars, single-line.
        body = (p.body or "").replace("\n", " ").strip()
        preview = body[:200] + ("..." if len(body) > 200 else "")
        out.append({
            "id": p.id,
            "title": p.title,
            "body_preview": preview,
            "category": p.category,
            "is_anonymous": anon,
            "is_sos": bool(p.is_sos),
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "author": author_payload,
        })
    return out
