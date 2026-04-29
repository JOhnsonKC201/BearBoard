"""Daily MSU-positive notes + motivational quotes.

Twice-daily auto-posts under the BearBoard Bot account:
- Morning (~9am ET): a short, positive Morgan State note.
- Afternoon (~3pm ET): another note OR a motivational quote, randomly.

Each post is short — note-length, 1-3 sentences plus a closing prompt so
the thread invites replies without feeling like a wall of text.

Idempotency: same 18-hour title-prefix guard the weekly threads use so a
scheduler restart on the same day doesn't double-post.

Content rotates through curated banks. The day-of-year + a deterministic
salt picks the entry so the order varies without state, and so the same
day always shows the same post if the scheduler retries.
"""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Callable

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.post import Post
from services.bot_user import get_or_create_bot

logger = logging.getLogger("bearboard.daily_posts")


# ---------------------------------------------------------------------------
# Content banks
# ---------------------------------------------------------------------------

# Short, positive, MSU-themed notes. 1-3 sentences + an invite to reply.
# Tone is warm, never cynical. Refer to students as "Bears" (MSU mascot).
MSU_NOTES: list[tuple[str, str]] = [
    (
        "Bear pride note: you belong here",
        "Morgan State has been making history since 1867. Every Bear "
        "walking these halls is part of that legacy. What does Morgan "
        "mean to you? Drop a line below.",
    ),
    (
        "Small win Wednesday",
        "Whatever you got done today — a problem set, a meeting, "
        "showing up — counts. Share one small win from this week so "
        "we can hype each other up.",
    ),
    (
        "Shoutout: a Bear who helped you out",
        "Whether it was a study buddy, an upperclassman, a TA, or a "
        "professor — drop their name (or a no-name shoutout) below. "
        "Recognition goes a long way.",
    ),
    (
        "Resource of the day: Earl S. Richardson Library",
        "Quiet floors, study rooms, and research librarians who will "
        "save you hours. If you've never used the librarian chat, "
        "today's a good day. Where do YOU like to study on campus?",
    ),
    (
        "MSU tradition spotlight: the Bear Walk",
        "From Truth Hall down to Holmes Hall — that walk has been "
        "made by generations of Bears chasing dreams. What's your "
        "favorite Morgan tradition?",
    ),
    (
        "Wellness check-in",
        "Quick check: water, sleep, food, a friend. Pick one you've "
        "been short on this week and tell us how you're going to fix "
        "it. Bears look out for Bears.",
    ),
    (
        "What's making you proud to be a Bear today?",
        "A grade, a club win, a friend's accomplishment, the band "
        "going off at a game — anything counts. Drop it below.",
    ),
    (
        "Goal-setting note",
        "Pick ONE thing you want to finish before the next 7 days "
        "are up. Post it here for accountability. We'll cheer you on.",
    ),
    (
        "MSU is leadership",
        "Morgan grads run boardrooms, classrooms, courtrooms, and "
        "newsrooms across the country. The bar's been set — and "
        "you're going to clear it. What's your plan after MSU?",
    ),
    (
        "Gratitude thread",
        "Name one thing you're grateful for at Morgan today — a "
        "person, a place, a moment. Reading these will lift the "
        "whole feed.",
    ),
    (
        "Try something new this week",
        "A club meeting, a different dining hall, a new study spot, "
        "a campus event you usually skip. Tell us what you're "
        "trying — accountability through the feed.",
    ),
    (
        "Bears help Bears",
        "Tutoring, a ride, lecture notes, a kind word — what's "
        "something you can offer this week? Even small offers "
        "compound. Drop yours below.",
    ),
]

# Motivational quotes. Mix of MSU alumni (Earl Graves Sr., Rep. Kweisi
# Mfume, Eddie C. Brown), CEOs, civil-rights leaders, athletes, and
# educators. Skewed toward Black leaders + MSU alumni since Morgan is
# an HBCU and the audience is overwhelmingly Black students.
QUOTES: list[tuple[str, str]] = [
    ("Earl Graves Sr. (Morgan State, '57; founder, Black Enterprise)",
     "We are unapologetically committed to empowering African Americans through entrepreneurship and economic opportunity."),
    ("Earl Graves Sr.",
     "The next generation of Black wealth builders is in our HBCU classrooms right now."),
    ("Kweisi Mfume (Morgan State, '76; U.S. Congressman)",
     "Education is the great equalizer — the one investment no one can take from you."),
    ("Eddie C. Brown (Morgan State; founder, Brown Capital Management)",
     "Discipline and patience compound. The same is true of money and of character."),
    ("Mae Jemison (first Black woman in space)",
     "Never be limited by other people's limited imaginations."),
    ("Maya Angelou",
     "I can be changed by what happens to me. But I refuse to be reduced by it."),
    ("Maya Angelou",
     "Nothing will work unless you do."),
    ("Booker T. Washington",
     "Excellence is to do a common thing in an uncommon way."),
    ("Frederick Douglass",
     "If there is no struggle, there is no progress."),
    ("Shirley Chisholm",
     "If they don't give you a seat at the table, bring a folding chair."),
    ("Michelle Obama",
     "There is no limit to what we, as women, can accomplish."),
    ("Barack Obama",
     "The best way to not feel hopeless is to get up and do something."),
    ("Oprah Winfrey",
     "Turn your wounds into wisdom."),
    ("Madam C.J. Walker",
     "I had to make my own living and my own opportunity. Don't sit down and wait for the opportunities to come."),
    ("Nelson Mandela",
     "It always seems impossible until it's done."),
    ("Toni Morrison",
     "If you have some power, then your job is to empower somebody else."),
    ("James Baldwin",
     "Not everything that is faced can be changed, but nothing can be changed until it is faced."),
    ("Serena Williams",
     "I really think a champion is defined not by their wins but by how they can recover when they fall."),
    ("Kobe Bryant",
     "The most important thing is to try and inspire people so that they can be great in whatever they want to do."),
    ("Steve Jobs",
     "The people who are crazy enough to think they can change the world are the ones who do."),
    ("Indra Nooyi (former CEO, PepsiCo)",
     "Just because you are CEO, don't think you have landed. You must continually relearn your job."),
    ("Ursula Burns (former CEO, Xerox; first Black woman to run a Fortune 500)",
     "Where you are is not who you are."),
    ("Ken Frazier (former CEO, Merck)",
     "Your only obligation is to be the best version of yourself."),
    ("Robert F. Smith (founder, Vista Equity)",
     "The fuel that ignites the engine of opportunity is education."),
    ("Reginald F. Lewis (first Black billionaire of his generation)",
     "Why should white guys have all the fun?"),
    ("MLK Jr.",
     "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward."),
    ("Sojourner Truth",
     "Truth is powerful and it prevails."),
    ("Thurgood Marshall",
     "None of us got where we are solely by pulling ourselves up by our bootstraps."),
]


# ---------------------------------------------------------------------------
# Helpers (parallel the weekly_threads idempotency pattern)
# ---------------------------------------------------------------------------

def _already_posted(db: Session, title_prefix: str, hours: int = 18) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    row = (
        db.query(Post.id)
        .filter(Post.title.like(f"{title_prefix}%"))
        .filter(Post.created_at >= cutoff)
        .first()
    )
    return bool(row)


def _post(title: str, body: str, category: str = "general") -> None:
    db = SessionLocal()
    try:
        bot = get_or_create_bot(db)
        # Use a stable prefix (everything before the date) so the
        # idempotency check catches a re-fire on the same day.
        prefix = title.split("—")[0].strip() or title
        if _already_posted(db, prefix):
            logger.info("daily_posts: skipped '%s' (already posted today)", title)
            return
        post = Post(
            title=title,
            body=body,
            category=category,
            author_id=bot.id,
            upvotes=0,
            downvotes=0,
        )
        db.add(post)
        db.commit()
        logger.info("daily_posts: created '%s'", title)
    except Exception:
        db.rollback()
        logger.exception("daily_posts: create failed for '%s'", title)
    finally:
        db.close()


def _today_label(now: datetime) -> str:
    """e.g. 'Apr 29, 2026'. Used as the title's date suffix."""
    return now.strftime("%b %-d, %Y") if hasattr(now, "strftime") else str(now)


def _deterministic_pick(bank: list, salt: int) -> tuple:
    """Pick an entry deterministically from `bank` based on the day-of-year
    plus a salt. Stable for a given day so a scheduler retry chooses the
    same content; varies day-to-day without persistent state."""
    now = datetime.now()
    seed = now.timetuple().tm_yday * 100 + salt
    rng = random.Random(seed)
    return rng.choice(bank)


# ---------------------------------------------------------------------------
# Scheduled jobs
# ---------------------------------------------------------------------------

def run_morning_note() -> None:
    """Always a note in the morning — sets a positive tone for the day."""
    note_title, note_body = _deterministic_pick(MSU_NOTES, salt=1)
    now = datetime.now()
    title = f"Morning note — {note_title} · {now.strftime('%b %d')}"
    _post(title, note_body)


def run_afternoon_post() -> None:
    """Afternoon alternates between a note and a quote. Roughly 50/50,
    seeded by day so the variety reads naturally."""
    now = datetime.now()
    rng = random.Random(now.timetuple().tm_yday * 100 + 2)
    if rng.random() < 0.5:
        note_title, note_body = _deterministic_pick(MSU_NOTES, salt=2)
        title = f"Afternoon note — {note_title} · {now.strftime('%b %d')}"
        _post(title, note_body)
    else:
        author, quote = _deterministic_pick(QUOTES, salt=3)
        title = f"Daily motivation · {now.strftime('%b %d')}"
        body = (
            f"“{quote}”\n\n"
            f"— {author}\n\n"
            "What hits home about this one for you today?"
        )
        _post(title, body)


# Convenience mapping for tests / one-shot CLI runs. Keep in sync with the
# scheduler registration in main.py.
DAILY_JOBS: dict[str, Callable[[], None]] = {
    "morning_note": run_morning_note,
    "afternoon_post": run_afternoon_post,
}


def run_all_now() -> None:
    """Fire both daily jobs once. Useful for manual bootstrap or tests."""
    for name, fn in DAILY_JOBS.items():
        logger.info("daily_posts: running %s now", name)
        fn()
