import logging
from contextlib import asynccontextmanager
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.config import ALLOWED_ORIGINS
from core.rate_limit import limiter
from routers import auth, posts, users, extras, ai, notifications, admin, professors, leaderboard, groups, search
from services.resurface import run_resurface
from services.morgan_events import sync_morgan_events
from services.daily_posts import run_morning_note, run_afternoon_post
from services.weekly_threads import (
    run_freshman_friday,
    run_class_registration_help,
    run_food_on_campus,
)

logger = logging.getLogger("bearboard.scheduler")

scheduler = AsyncIOScheduler()


def _resurface_job():
    try:
        result = run_resurface()
        logger.info("resurface job completed: %s", result)
    except Exception:
        logger.exception("resurface job failed")


def _morgan_events_job():
    try:
        result = sync_morgan_events()
        logger.info("morgan_events sync completed: %s", result)
    except Exception:
        logger.exception("morgan_events sync failed")


def _safe(job_name: str, fn):
    """Wrap a weekly-thread job so its exceptions don't kill the
    APScheduler worker thread. Logged + swallowed."""
    def runner():
        try:
            fn()
        except Exception:
            logger.exception("weekly thread '%s' failed", job_name)
    return runner


def _seed_professors_if_sparse():
    """Run the curated MSU faculty seed when the professors table looks empty.

    Idempotent twice over: the seed script itself dedupes case-insensitively,
    and we only call it when the row count is below a low threshold so a
    populated production DB never re-runs the script. This means a fresh
    Render deploy lands with the full directory without anyone having to
    SSH in and run the script by hand.
    """
    try:
        from core.database import SessionLocal
        from models.professor import Professor
        db = SessionLocal()
        try:
            count = db.query(Professor).count()
        finally:
            db.close()
        # 5 = "basically empty" — anything above that means a real DB and we
        # leave it alone (admins extend via the UI from there).
        if count >= 5:
            logger.info("seed_professors: skipped (DB has %d profs)", count)
            return
        from seed_professors import main as run_seed
        rc = run_seed()
        logger.info("seed_professors: ran (exit %s)", rc)
    except Exception:
        logger.exception("seed_professors: startup seed failed (non-fatal)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_professors_if_sparse()
    scheduler.add_job(_resurface_job, "interval", hours=1, id="resurface", replace_existing=True)
    scheduler.add_job(
        _morgan_events_job,
        "interval",
        hours=6,
        id="morgan_events",
        replace_existing=True,
        next_run_time=datetime.now(),
    )
    # Weekly community threads. Cron trigger fires once per week on the
    # designated day/hour. Times are in the app process's local tz; on
    # Render that's UTC unless overridden. For a Morgan-local feel, pick
    # hours that read reasonably both in UTC and ET.
    scheduler.add_job(
        _safe("freshman_friday", run_freshman_friday),
        "cron", day_of_week="fri", hour=13, minute=0,
        id="freshman_friday", replace_existing=True,
    )
    scheduler.add_job(
        _safe("class_registration_help", run_class_registration_help),
        "cron", day_of_week="mon", hour=13, minute=0,
        id="class_registration_help", replace_existing=True,
    )
    scheduler.add_job(
        _safe("food_on_campus", run_food_on_campus),
        "cron", day_of_week="wed", hour=16, minute=0,
        id="food_on_campus", replace_existing=True,
    )
    # Daily MSU-positive notes + occasional motivational quote. Authored by
    # the BearBoard Bot so the human admin's name doesn't show on auto-content.
    # Hours are UTC since Render runs in UTC; 13:00 UTC ≈ 9am ET, 19:00 UTC ≈ 3pm ET.
    scheduler.add_job(
        _safe("morning_note", run_morning_note),
        "cron", hour=13, minute=0,
        id="morning_note", replace_existing=True,
    )
    scheduler.add_job(
        _safe("afternoon_post", run_afternoon_post),
        "cron", hour=19, minute=0,
        id="afternoon_post", replace_existing=True,
    )
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="BearBoard API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(users.router)
app.include_router(extras.router)
app.include_router(ai.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(professors.router)
app.include_router(leaderboard.router)
app.include_router(groups.router)


@app.get("/")
def root():
    return {"message": "BearBoard API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
