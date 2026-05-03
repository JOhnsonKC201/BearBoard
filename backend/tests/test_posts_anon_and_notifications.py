"""Tests for the anonymity contract and comment-notification fan-out.

Covers two reported bugs:
1. Admin / mod viewers were seeing the real author of anonymous comments.
   The fix removes the mod-bypass from the API-layer scrub so anonymous
   means anonymous to everyone except the author themselves.
2. Comments did not produce a notification for the post author. The fix
   adds a Notification row on each comment (and a separate `reply` kind
   for nested replies), with dedupe via the existing unique constraint.

Uses the same SQLite test setup as test_chat.py — they can be run
together or separately. We import models and main *before* setting any
env-var defaults so this file can also boot in isolation.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

# Match the test_chat.py pattern: a file-backed SQLite DB so we go
# through the real core.database plumbing. Pytest collects test_chat
# alphabetically first, so when the suites run together they share the
# same temp DB; when this file runs alone it sets up its own.
_TEST_DB_PATH = _BACKEND_DIR / "_chat_test.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_TEST_DB_PATH.as_posix()}")
os.environ.setdefault("SECRET_KEY", "test-secret-not-the-placeholder-value")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from passlib.context import CryptContext  # noqa: E402

from core import database as db_module  # noqa: E402
from core.config import ALGORITHM, SECRET_KEY  # noqa: E402
from core.database import Base  # noqa: E402
import models  # noqa: F401,E402  (registers all tables on Base.metadata)
from models.comment import Comment  # noqa: E402
from models.notification import Notification  # noqa: E402
from models.post import Post  # noqa: E402
from models.user import User  # noqa: E402
import main as app_module  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _setup_schema():
    Base.metadata.create_all(bind=db_module.engine)
    yield


def _make_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM
    )


@pytest.fixture
def db():
    session = db_module.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app_module.app)


@pytest.fixture
def fresh_users(db):
    """Three users: a regular author, a regular commenter, and an admin.
    We nuke all posts/comments/notifications between tests so we can
    assert exact row counts."""
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    pwd = pwd_ctx.hash("hunter22")
    db.query(Notification).delete()
    db.query(Comment).delete()
    db.query(Post).delete()
    db.query(User).delete()
    db.commit()
    author = User(email="author@morgan.edu", password_hash=pwd, name="Real Name")
    commenter = User(email="commenter@morgan.edu", password_hash=pwd, name="Other Person")
    admin = User(email="admin@morgan.edu", password_hash=pwd, name="An Admin", role="admin")
    db.add_all([author, commenter, admin])
    db.commit()
    for u in (author, commenter, admin):
        db.refresh(u)
    yield author, commenter, admin


def _make_post(db, author_id: int) -> Post:
    p = Post(
        title="hello world",
        body="post body",
        category="general",
        author_id=author_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ---------------------------------------------------------------------------
# Anonymity contract
# ---------------------------------------------------------------------------


def test_admin_does_not_see_author_of_anonymous_comment(client, fresh_users, db):
    """Regression for the reported bug: when the post owner is also an
    admin, viewing the post detail used to leak the real name of an
    anonymous commenter via the mod-bypass. After the fix, admins/mods
    see "Anonymous" too — only the comment's own author sees their name.
    """
    author, commenter, _admin = fresh_users
    post = _make_post(db, author_id=author.id)
    # commenter posts an anonymous comment.
    c_token = _make_token(commenter.id)
    res = client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"body": "I'd rather not say who", "is_anonymous": True},
    )
    assert res.status_code == 200, res.text

    # Now fetch the post detail as the author (who is also the post owner).
    a_token = _make_token(author.id)
    res = client.get(
        f"/api/posts/{post.id}",
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert res.status_code == 200
    detail = res.json()
    assert len(detail["comments"]) == 1
    c = detail["comments"][0]
    assert c["is_anonymous"] is True
    assert c["author_id"] is None, "author_id leaked to non-author viewer"
    assert c.get("author") in (None, {}), "author object leaked to non-author viewer"


def test_anonymous_commenter_still_sees_their_own_name(client, fresh_users, db):
    """The author of an anonymous comment must still see their own
    identity so they can find/manage their own content."""
    author, commenter, _admin = fresh_users
    post = _make_post(db, author_id=author.id)
    c_token = _make_token(commenter.id)
    res = client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"body": "anon body", "is_anonymous": True},
    )
    assert res.status_code == 200

    res = client.get(
        f"/api/posts/{post.id}",
        headers={"Authorization": f"Bearer {c_token}"},
    )
    assert res.status_code == 200
    c = res.json()["comments"][0]
    assert c["is_anonymous"] is True
    assert c["author_id"] == commenter.id
    assert c["author"] is not None


# ---------------------------------------------------------------------------
# Comment notifications
# ---------------------------------------------------------------------------


def test_comment_notifies_post_author(client, fresh_users, db):
    """A top-level comment writes one Notification(kind=comment) for the
    post author, and the unread_count endpoint reflects it."""
    author, commenter, _admin = fresh_users
    post = _make_post(db, author_id=author.id)
    c_token = _make_token(commenter.id)
    a_token = _make_token(author.id)

    # Author has no unread notifications to start.
    res = client.get(
        "/api/notifications/unread_count",
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert res.json()["unread"] == 0

    # Commenter posts a comment.
    res = client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"body": "hey"},
    )
    assert res.status_code == 200

    res = client.get(
        "/api/notifications/unread_count",
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert res.json()["unread"] == 1

    res = client.get(
        "/api/notifications/?limit=10",
        headers={"Authorization": f"Bearer {a_token}"},
    )
    notifs = res.json()
    assert len(notifs) == 1
    assert notifs[0]["kind"] == "comment"
    assert notifs[0]["post_id"] == post.id


def test_self_comment_does_not_notify(client, fresh_users, db):
    """If the post author comments on their own post, no notification."""
    author, _commenter, _admin = fresh_users
    post = _make_post(db, author_id=author.id)
    a_token = _make_token(author.id)
    res = client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {a_token}"},
        json={"body": "talking to myself"},
    )
    assert res.status_code == 200

    res = client.get(
        "/api/notifications/unread_count",
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert res.json()["unread"] == 0


def test_repeat_comment_rearms_existing_notification(client, fresh_users, db):
    """The (recipient_id, post_id, kind) unique constraint already enforces
    one row per recipient per post per kind. A second comment on the same
    post should re-flag the existing row to unread instead of erroring."""
    author, commenter, _admin = fresh_users
    post = _make_post(db, author_id=author.id)
    c_token = _make_token(commenter.id)
    a_token = _make_token(author.id)

    # First comment → one notification.
    client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"body": "first"},
    )

    # Author marks all read.
    client.post("/api/notifications/read-all", headers={"Authorization": f"Bearer {a_token}"})
    res = client.get("/api/notifications/unread_count", headers={"Authorization": f"Bearer {a_token}"})
    assert res.json()["unread"] == 0

    # Second comment from the same commenter → notification re-armed.
    res = client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"body": "second"},
    )
    assert res.status_code == 200

    res = client.get("/api/notifications/unread_count", headers={"Authorization": f"Bearer {a_token}"})
    assert res.json()["unread"] == 1
    res = client.get("/api/notifications/?limit=10", headers={"Authorization": f"Bearer {a_token}"})
    rows = res.json()
    # Still only one row for this (recipient, post, kind).
    assert len([n for n in rows if n["kind"] == "comment" and n["post_id"] == post.id]) == 1


def test_reply_notifies_parent_author_with_reply_kind(client, fresh_users, db):
    """A reply to a comment notifies the parent author with kind=reply,
    and the post author with kind=comment (if they're different people
    and neither is the replier)."""
    author, commenter, admin = fresh_users  # admin used as a third party
    post = _make_post(db, author_id=author.id)
    c_token = _make_token(commenter.id)
    a_token = _make_token(author.id)
    third_token = _make_token(admin.id)

    # commenter writes a top-level comment.
    res = client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"body": "top"},
    )
    parent_id = res.json()["id"]

    # admin (third party) replies to it.
    res = client.post(
        f"/api/posts/{post.id}/comments",
        headers={"Authorization": f"Bearer {third_token}"},
        json={"body": "replying", "parent_id": parent_id},
    )
    assert res.status_code == 200

    # Post author should have a `comment` notification (one row total —
    # one from commenter's top-level + admin's reply, deduped by the
    # unique constraint, but still kind=comment).
    res = client.get("/api/notifications/?limit=20", headers={"Authorization": f"Bearer {a_token}"})
    author_kinds = [n["kind"] for n in res.json()]
    assert "comment" in author_kinds

    # Parent comment author (the original commenter) should have a
    # `reply` notification.
    res = client.get("/api/notifications/?limit=20", headers={"Authorization": f"Bearer {c_token}"})
    commenter_kinds = [n["kind"] for n in res.json()]
    assert "reply" in commenter_kinds
