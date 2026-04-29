"""Weekly recurring community threads.

APScheduler fires three cron jobs on their designated day/hour. Each
creates a fresh post from an admin account with the current week in the
title so students can spot "this week's" thread in the feed.

Idempotency: before creating, we look for a post whose title starts with
the same week-of header within the last 18 hours — this catches an
accidental double-fire (e.g. scheduler restart on the same day) without
needing a dedicated lock table.

Scheduled slots (America/New_York; see main.py for the timezone setting):
- Freshman Friday         — Fri 09:00
- Class Registration Help — Mon 09:00
- Food on Campus          — Wed 12:00

Each template is a (title_fmt, category, body) tuple. title_fmt is a
strftime-style format applied to the week-start date (Monday).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.post import Post
from models.user import User

logger = logging.getLogger("bearboard.weekly_threads")


def _week_start(now: datetime) -> datetime:
    """Monday of the week that contains `now`, at 00:00 local."""
    d = now.date()
    monday = d - timedelta(days=d.weekday())
    return datetime.combine(monday, datetime.min.time())


def _author_id(db: Session) -> int | None:
    # System-generated threads post under the BearBoard Bot account so the
    # human admin's name doesn't appear on auto-content.
    from services.bot_user import get_or_create_bot
    try:
        bot = get_or_create_bot(db)
        return bot.id
    except Exception:
        logger.exception("weekly_threads: failed to resolve bot user; falling back to first admin")
    admin = db.query(User).filter(User.role == "admin").order_by(User.id).first()
    if admin:
        return admin.id
    any_user = db.query(User).order_by(User.id).first()
    return any_user.id if any_user else None


def _already_posted_this_week(db: Session, title_prefix: str) -> bool:
    """Return True if a post starting with `title_prefix` was created in
    the last 18 hours. Close enough to "this run of the cron" without
    a dedicated schedule lock."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=18)
    row = (
        db.query(Post.id)
        .filter(Post.title.like(f"{title_prefix}%"))
        .filter(Post.created_at >= cutoff)
        .first()
    )
    return bool(row)


def _post_weekly(title: str, category: str, body: str) -> None:
    db = SessionLocal()
    try:
        author_id = _author_id(db)
        if author_id is None:
            logger.warning("weekly_threads: no users in DB, skipping '%s'", title)
            return
        prefix = title.split("—")[0].strip() or title
        if _already_posted_this_week(db, prefix):
            logger.info("weekly_threads: skipped '%s' (already posted this week)", title)
            return
        post = Post(
            title=title,
            body=body,
            category=category,
            author_id=author_id,
            upvotes=0,
            downvotes=0,
        )
        db.add(post)
        db.commit()
        logger.info("weekly_threads: created '%s'", title)
    except Exception:
        db.rollback()
        logger.exception("weekly_threads: create failed for '%s'", title)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Thread bodies — deliberately a little chatty so the first time a student
# sees the thread they immediately know what to post.
# ---------------------------------------------------------------------------

FRESHMAN_FRIDAY_BODY = (
    "Freshman Friday. This is the no-dumb-questions thread for first-year Bears.\n\n"
    "Drop anything you're unsure about:\n"
    "- Where's the best place to print on campus?\n"
    "- How do I register for add/drop?\n"
    "- Which dining hall line is fastest between 12:30-1:15?\n"
    "- What meal swipes actually work at the retail spots?\n"
    "- How do I talk to my advisor?\n\n"
    "Upperclassmen: drop into the thread and answer a couple. Your "
    "sophomore year was someone else's freshman year."
)

CLASS_REGISTRATION_BODY = (
    "Class Registration Help - weekly thread.\n\n"
    "If you're on the waitlist, stuck on a hold, or trying to build a schedule "
    "that doesn't have a 3-hour gap on Wednesdays, this is the place.\n\n"
    "Post the following so people can actually help:\n"
    "- Major + year\n"
    "- Courses you need (with CRN if you have it)\n"
    "- What's blocking you (hold, waitlist, prereq, time conflict)\n"
    "- Tried your advisor? The registrar (see /resources)?\n\n"
    "Do NOT share your MSU ID, password, or DUO code in this thread. "
    "For account-specific issues go to https://www.morgan.edu/registrar."
)

FOOD_ON_CAMPUS_BODY = (
    "Food on Campus - weekly thread.\n\n"
    "What's actually good this week?\n"
    "- Which dining hall line moves and which one doesn't\n"
    "- New food-truck spots + surprise pop-ups\n"
    "- Hidden retail locations that still have meal-swipe equivalency\n"
    "- Pro tips: hours before finals, late-night options, off-campus\n"
    "  spots that take campus cash.\n\n"
    "If a spot is closed or out of an advertised item, post here so "
    "the next person doesn't waste a trip."
)


# ---------------------------------------------------------------------------
# Public API used by main.py
# ---------------------------------------------------------------------------

def _week_of(now: datetime) -> str:
    ws = _week_start(now)
    return ws.strftime("%b %d, %Y")


def run_freshman_friday() -> None:
    now = datetime.now()
    title = f"Freshman Friday — Week of {_week_of(now)}"
    _post_weekly(title, "general", FRESHMAN_FRIDAY_BODY)


def run_class_registration_help() -> None:
    now = datetime.now()
    title = f"Class Registration Help — Week of {_week_of(now)}"
    _post_weekly(title, "academic", CLASS_REGISTRATION_BODY)


def run_food_on_campus() -> None:
    now = datetime.now()
    title = f"Food on Campus — Week of {_week_of(now)}"
    _post_weekly(title, "general", FOOD_ON_CAMPUS_BODY)


# Convenience mapping used by tests / one-shot CLIs. Keep in sync with the
# scheduler registration in main.py.
WEEKLY_JOBS: dict[str, Callable[[], None]] = {
    "freshman_friday": run_freshman_friday,
    "class_registration_help": run_class_registration_help,
    "food_on_campus": run_food_on_campus,
}


def run_all_now() -> None:
    """Fire every weekly thread once (used for backfilling or manual
    bootstrap after the scheduler missed a window)."""
    for name, fn in WEEKLY_JOBS.items():
        logger.info("weekly_threads: running %s now", name)
        fn()


if __name__ == "__main__":
    run_all_now()
