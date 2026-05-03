"""Tests for group chat (Phase 1).

Mirrors the test infrastructure of `test_chat.py` and `test_posts_anon_and_notifications.py`
— same SQLite test DB, same JWT helper, same fixture pattern.

Covers:
- Members can post + read history; non-members are 403'd
- Author can edit within the 15-minute window; outside it returns 400
- Non-author cannot edit someone else's message (403)
- Banned members cannot post (403); muted members cannot post (403)
- WS group_send round-trips a message to every connected member
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

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
import models  # noqa: F401,E402  (registers all tables)
from models.group import Group  # noqa: E402
from models.group_member import GroupMember  # noqa: E402
from models.group_message import GroupMessage  # noqa: E402
from models.user import User  # noqa: E402
import main as app_module  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _setup_schema():
    Base.metadata.create_all(bind=db_module.engine)
    yield


def _make_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


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
def group_with_members(db):
    """Three users: an owner (creator), a member, and a non-member.
    A group with the first two as active members."""
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto").hash("hunter22")
    db.query(GroupMessage).delete()
    db.query(GroupMember).delete()
    db.query(Group).delete()
    db.query(User).delete()
    db.commit()

    owner = User(email="owner@morgan.edu", password_hash=pwd, name="Owner")
    member = User(email="member@morgan.edu", password_hash=pwd, name="Member")
    outsider = User(email="outsider@morgan.edu", password_hash=pwd, name="Outsider")
    db.add_all([owner, member, outsider])
    db.commit()
    for u in (owner, member, outsider):
        db.refresh(u)

    g = Group(name="Test Group", description="", created_by=owner.id, member_count=2)
    db.add(g)
    db.commit()
    db.refresh(g)

    db.add_all([
        GroupMember(group_id=g.id, user_id=owner.id, role="owner", status="active"),
        GroupMember(group_id=g.id, user_id=member.id, role="member", status="active"),
    ])
    db.commit()

    yield owner, member, outsider, g


# ---------------------------------------------------------------------------
# REST: send + read
# ---------------------------------------------------------------------------


def test_member_can_send_and_read_messages(client, group_with_members):
    owner, member, _outsider, g = group_with_members
    o_token = _make_token(owner.id)
    m_token = _make_token(member.id)

    # Owner sends.
    res = client.post(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {o_token}"},
        json={"body": "hi everyone"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["body"] == "hi everyone"

    # Other member reads.
    res = client.get(
        f"/api/groups/{g.id}/messages?limit=10",
        headers={"Authorization": f"Bearer {m_token}"},
    )
    assert res.status_code == 200
    bodies = [m["body"] for m in res.json()]
    assert "hi everyone" in bodies


def test_non_member_cannot_post_or_read(client, group_with_members):
    _owner, _member, outsider, g = group_with_members
    token = _make_token(outsider.id)

    res = client.post(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "I should not be here"},
    )
    assert res.status_code == 403

    res = client.get(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_banned_member_cannot_post(client, group_with_members, db):
    _owner, member, _outsider, g = group_with_members
    # Ban the member.
    db.query(GroupMember).filter(
        GroupMember.group_id == g.id, GroupMember.user_id == member.id
    ).update({GroupMember.status: "banned"})
    db.commit()

    token = _make_token(member.id)
    res = client.post(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "still here?"},
    )
    assert res.status_code == 403


def test_muted_member_cannot_post_but_can_read(client, group_with_members, db):
    owner, member, _outsider, g = group_with_members
    o_token = _make_token(owner.id)
    m_token = _make_token(member.id)

    # Owner posts something readable.
    client.post(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {o_token}"},
        json={"body": "hello"},
    )

    # Mute the member.
    db.query(GroupMember).filter(
        GroupMember.group_id == g.id, GroupMember.user_id == member.id
    ).update({GroupMember.muted: True})
    db.commit()

    # Read works.
    res = client.get(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {m_token}"},
    )
    assert res.status_code == 200
    assert any(m["body"] == "hello" for m in res.json())

    # Send is blocked.
    res = client.post(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {m_token}"},
        json={"body": "muted me?"},
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# REST: edit
# ---------------------------------------------------------------------------


def test_owner_can_edit_own_message(client, group_with_members):
    owner, _member, _outsider, g = group_with_members
    token = _make_token(owner.id)
    res = client.post(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "v1"},
    )
    msg_id = res.json()["id"]

    res = client.patch(
        f"/api/groups/{g.id}/messages/{msg_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "v2"},
    )
    assert res.status_code == 200
    assert res.json()["body"] == "v2"
    assert res.json()["edited_at"] is not None


def test_other_member_cannot_edit(client, group_with_members):
    owner, member, _outsider, g = group_with_members
    o_token = _make_token(owner.id)
    m_token = _make_token(member.id)

    res = client.post(
        f"/api/groups/{g.id}/messages",
        headers={"Authorization": f"Bearer {o_token}"},
        json={"body": "owner's message"},
    )
    msg_id = res.json()["id"]

    res = client.patch(
        f"/api/groups/{g.id}/messages/{msg_id}",
        headers={"Authorization": f"Bearer {m_token}"},
        json={"body": "rewriting"},
    )
    assert res.status_code == 403


def test_edit_after_window_rejected(client, group_with_members, db):
    owner, _member, _outsider, g = group_with_members
    token = _make_token(owner.id)

    # Insert directly with an old timestamp.
    msg = GroupMessage(
        group_id=g.id,
        author_id=owner.id,
        body="too old",
        created_at=(datetime.now(timezone.utc) - timedelta(minutes=20)).replace(tzinfo=None),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    res = client.patch(
        f"/api/groups/{g.id}/messages/{msg.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "trying anyway"},
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# WebSocket: live send
# ---------------------------------------------------------------------------


def test_ws_group_send_broadcasts_to_members(client, group_with_members):
    """Owner sends via WS group_send frame; both owner and member receive
    a `group_message` frame with the new content."""
    owner, member, _outsider, g = group_with_members
    o_token = _make_token(owner.id)
    m_token = _make_token(member.id)

    with client.websocket_connect(f"/api/chat/ws?token={o_token}") as o_ws:
        with client.websocket_connect(f"/api/chat/ws?token={m_token}") as m_ws:
            # Drain hellos + presence frames so the test only inspects the
            # message round-trip we care about.
            o_ws.receive_json()
            m_ws.receive_json()
            o_ws.receive_json()  # member came online presence

            o_ws.send_json({"type": "group_send", "group_id": g.id, "body": "hi group"})
            o_recv = o_ws.receive_json()
            m_recv = m_ws.receive_json()
            for frame in (o_recv, m_recv):
                assert frame["type"] == "group_message"
                assert frame["group_id"] == g.id
                assert frame["body"] == "hi group"
                assert frame["author_id"] == owner.id
