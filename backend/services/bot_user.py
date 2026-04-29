"""Find-or-create the BearBoard bot user.

System-generated content (weekly threads, daily MSU notes, motivational
quotes) is authored by this account so the posts stop showing up under
the human admin's name. The bot is a regular `users` row with role='admin'
and a sentinel password_hash so no one can log in as it.

Idempotent on every call — safe to invoke at scheduler startup or on any
job execution. Lookup is by email (the unique key) to avoid duplicate
rows if the seed script and the runtime helper both run.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from models.user import User

logger = logging.getLogger("bearboard.bot_user")

BOT_EMAIL = "bot@bearboard.local"
BOT_NAME = "BearBoard Bot"
# Sentinel — no real bcrypt hash matches this prefix, so every login attempt
# falls through. Mirrors the "!pending" sentinel used by grant_role.py.
BOT_PASSWORD_HASH = "!bot"


def get_or_create_bot(db: Session) -> User:
    bot = db.query(User).filter(User.email == BOT_EMAIL).first()
    if bot is not None:
        # Self-heal role drift if someone manually demoted the bot.
        if bot.role != "admin":
            bot.role = "admin"
            db.commit()
        return bot

    bot = User(
        email=BOT_EMAIL,
        name=BOT_NAME,
        password_hash=BOT_PASSWORD_HASH,
        role="admin",
        # No major/graduation_year — bot isn't a student.
        karma=0,
        streak_count=0,
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    logger.info("bot_user: created BearBoard Bot (id=%s)", bot.id)
    return bot
