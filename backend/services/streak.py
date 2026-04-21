"""User activity-streak helper.

A streak counts consecutive UTC days the user did something meaningful
(currently: posted, commented, or hit /api/users/me/checkin). Same-day
calls are no-ops; missing a day resets to 1 on the next bump.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models.user import User


def bump_streak(db: Session, user: User, today: date | None = None) -> dict:
    """Update the user's streak based on today's UTC date.

    Returns the new streak state. Caller must commit the session.
    """
    # Explicit UTC so deployments in other timezones can't drift midnight
    # boundaries relative to created_at (which is stored in UTC via func.now()).
    today = today or datetime.now(timezone.utc).date()
    last = user.last_activity_date

    if last == today:
        return {"streak_count": user.streak_count, "bumped": False}

    if last == today - timedelta(days=1):
        user.streak_count = (user.streak_count or 0) + 1
    else:
        user.streak_count = 1

    user.last_activity_date = today
    return {"streak_count": user.streak_count, "bumped": True}
