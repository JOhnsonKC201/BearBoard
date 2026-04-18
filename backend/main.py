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
from routers import auth, posts, users, extras, ai, notifications, admin, professors
from services.resurface import run_resurface
from services.morgan_events import sync_morgan_events

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(_resurface_job, "interval", hours=1, id="resurface", replace_existing=True)
    scheduler.add_job(
        _morgan_events_job,
        "interval",
        hours=6,
        id="morgan_events",
        replace_existing=True,
        next_run_time=datetime.now(),
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


@app.get("/")
def root():
    return {"message": "BearBoard API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
