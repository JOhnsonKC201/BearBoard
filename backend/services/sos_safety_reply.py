"""BearBoard Bot auto-replies on SOS posts with Campus Safety numbers.

The moment an SOS post is created, this service drops in a top-level
comment authored by the BearBoard Bot user containing every safety contact
a student in distress would need (Campus Police, Safety Escort, Title IX,
Counseling Center). Mobile browsers auto-detect the `tel:`/`mailto:`
formatting on the numbers, so a tap dials directly.

Design choices:

- Reuses the existing bot account from `services.bot_user.get_or_create_bot`
  so the platform's "voice" stays consistent with the daily MSU notes and
  weekly thread posts the bot already publishes.
- The body deliberately matches the layout of `frontend/src/components/SafetyBox.jsx`
  (the right-rail safety panel) so adding/correcting a number eventually
  becomes a single source-of-truth refactor — for now the duplication is
  small (5 contacts) and the cross-surface consistency is the priority.
- Idempotent on the (post_id, bot author_id) pair: if a bot comment
  already exists on this post, we return None instead of creating a
  duplicate. Defensive against a future code path (e.g. a backfill
  script) calling us twice on the same row.
- Caller is responsible for committing — we only `db.add` so the
  comment lands in the same transaction as the SOS post itself, the
  notification fan-out, and the streak bump. One commit, atomic.
- Never raises. The SOS post must succeed even if the bot reply fails
  (bot table missing, DB hiccup, etc.). The wrapper in `routers/posts.py`
  ALSO has a try/except as belt-and-suspenders, but we degrade gracefully
  here too.
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from models.comment import Comment
from models.post import Post
from services.bot_user import get_or_create_bot

logger = logging.getLogger("bearboard.sos_safety_reply")


# Body kept as a module-level constant so a future test can assert against
# it without re-implementing the formatting. Multi-line plain text — the
# comment renderer uses `whitespace-pre-wrap` so newlines display intact,
# and mobile Safari / Chrome auto-detect both `tel:` numbers and email
# addresses for click-through dialing/mailing.
SAFETY_REPLY_BODY = (
    "🚨 If you need help right now, here are the numbers to call:\n"
    "\n"
    "📞 Campus Police (Emergency): 443-885-3103\n"
    "📞 Campus Police (Non-Emergency): 443-885-3125\n"
    "🚶 Safety Escort (after dark): 443-885-3103\n"
    "📧 Title IX Office: titleix@morgan.edu\n"
    "💬 Counseling Center (24/7): 443-885-3130\n"
    "\n"
    "Stay safe. Help is one call away."
)


def post_safety_reply(db: Session, post: Post) -> Optional[Comment]:
    """Add a BearBoard Bot comment with campus safety contacts to an SOS post.

    Returns the new Comment (already added to the session, NOT yet
    committed) on success, or None if the bot already replied to this
    post or if any error prevented creation. Never raises — the calling
    SOS-post creation path must always succeed even if this helper fails.
    """
    if post is None or post.id is None:
        # Caller must have flushed already so post.id is populated.
        # Bail rather than create an orphan comment.
        logger.warning("sos_safety_reply: post or post.id is None; skipping")
        return None

    try:
        bot = get_or_create_bot(db)
    except Exception:
        logger.exception("sos_safety_reply: get_or_create_bot failed; skipping")
        return None

    # Idempotency: skip if the bot has already replied to this post. Cheap
    # one-row LIMIT 1 query keyed on the existing index on comments.post_id.
    existing = (
        db.query(Comment.id)
        .filter(Comment.post_id == post.id, Comment.author_id == bot.id)
        .first()
    )
    if existing is not None:
        logger.info("sos_safety_reply: bot already replied to post=%s; skipping", post.id)
        return None

    try:
        reply = Comment(
            body=SAFETY_REPLY_BODY,
            author_id=bot.id,
            post_id=post.id,
            parent_id=None,  # top-level comment so it shows at the head of the thread
            is_anonymous=False,  # the bot's identity is the whole point
        )
        db.add(reply)
        # Flush so the caller's later refresh on the post pulls the comment
        # into the joinedload without an extra query.
        db.flush()
        logger.info("sos_safety_reply: posted bot reply (comment=%s) on post=%s", reply.id, post.id)
        return reply
    except Exception:
        logger.exception("sos_safety_reply: insert failed for post=%s; skipping", post.id)
        return None
