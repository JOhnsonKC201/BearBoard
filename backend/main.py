import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, posts, users, extras, ai, notifications
from services.resurface import run_resurface

logger = logging.getLogger("bearboard.scheduler")

scheduler = AsyncIOScheduler()


def _resurface_job():
    try:
        result = run_resurface()
        logger.info("resurface job completed: %s", result)
    except Exception:
        logger.exception("resurface job failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(_resurface_job, "interval", hours=1, id="resurface", replace_existing=True)
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="BearBoard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/")
def root():
    return {"message": "BearBoard API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
