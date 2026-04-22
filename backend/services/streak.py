"""User activity-streak helper.

A streak counts consecutive *Baltimore-local* calendar days the user did
something meaningful (currently: posted, commented, or hit
/api/users/me/checkin). Same-day calls are no-ops; missing a day resets
to 1 on the next bump.

Baltimore (America/New_York) is hardcoded because BearBoard is a
Morgan State product. Using UTC previously caused the streak to bump
mid-evening Eastern time (when UTC already rolled into the next day),
so a student who logged in at 6pm and checked back at 8pm saw their
streak increment twice in a single local day.
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from models.user import User

# App-local timezone. Change this if you ever deploy a partner school
# in a different region; the streak logic only depends on this constant.
APP_TZ = ZoneInfo("America/New_York")


def today_local() -> date:
    """Current calendar date in Baltimore / Morgan State's timezone."""
    return datetime.now(APP_TZ).date()


def bump_streak(db: Session, user: User, today: date | None = None) -> dict:
    """Update the user's streak based on today's Baltimore-local date.

    Returns the new streak state. Caller must commit the session.
    """
    today = today or today_local()
    last = user.last_activity_date

    if last == today:
        return {"streak_count": user.streak_count, "bumped": False}

    if last == today - timedelta(days=1):
        user.streak_count = (user.streak_count or 0) + 1
    else:
        user.streak_count = 1

    user.last_activity_date = today
    return {"streak_count": user.streak_count, "bumped": True}
