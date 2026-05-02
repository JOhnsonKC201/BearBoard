"""Smoke tests for BearChat.

Covers:
- ConnectionManager registration / fan-out / disconnect with mock sockets.
- WebSocket auth: bad token closes 4401, good token accepts and echoes a hello.
- Send → persist → echo + push round-trip with two clients on the same uvicorn.
- REST history endpoint pagination and authentication gate.

Tests use a file-backed SQLite DB so they go through the real
`core.database` plumbing (engine + SessionLocal + get_db) without
depending on monkey-patching module-level names. The DB file is removed
at session teardown.
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make the backend package importable regardless of where pytest is invoked.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

# Test config: must be set BEFORE core.config (which raises on placeholder).
_TEST_DB_PATH = _BACKEND_DIR / "_chat_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH.as_posix()}"
os.environ.setdefault("SECRET_KEY", "test-secret-not-the-placeholder-value")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from core import database as db_module  # noqa: E402
from core.config import ALGORITHM, SECRET_KEY  # noqa: E402
from core.database import Base  # noqa: E402
import models  # noqa: F401,E402  (registers all tables on Base.metadata)
from models.chat_message import ChatMessage  # noqa: E402
from models.user import User  # noqa: E402
from passlib.context import CryptContext  # noqa: E402
from services.chat_manager import ConnectionManager  # noqa: E402
import main as app_module  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _setup_schema():
    if _TEST_DB_PATH.exists():
        _TEST_DB_PATH.unlink()
    Base.metadata.create_all(bind=db_module.engine)
    yield
    db_module.engine.dispose()
    if _TEST_DB_PATH.exists():
        try:
            _TEST_DB_PATH.unlink()
        except PermissionError:
            pass  # Windows holds the handle briefly after dispose; harmless.


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
def two_users(db):
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto").hash("hunter22")
    db.query(ChatMessage).delete()
    db.query(User).delete()
    db.commit()
    alice = User(email="alice@morgan.edu", password_hash=pwd, name="Alice")
    bob = User(email="bob@morgan.edu", password_hash=pwd, name="Bob")
    db.add_all([alice, bob])
    db.commit()
    db.refresh(alice)
    db.refresh(bob)
    yield alice, bob


# ---------------------------------------------------------------------------
# ConnectionManager unit tests
# ---------------------------------------------------------------------------


class _FakeSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []
        self.closed = False
        self.close_code: int | None = None

    async def send_json(self, payload: dict) -> None:
        if self.closed:
            raise RuntimeError("socket closed")
        self.sent.append(payload)

    async def close(self, code: int = 1000) -> None:
        self.closed = True
        self.close_code = code


def test_manager_connect_disconnect_roundtrip():
    async def run():
        mgr = ConnectionManager()
        ws_a, ws_b = _FakeSocket(), _FakeSocket()
        first_a = await mgr.connect(1, ws_a)
        assert first_a is True
        first_again = await mgr.connect(1, ws_b)
        assert first_again is False
        assert mgr.is_online(1)
        sent = await mgr.send_to(1, {"type": "ping"})
        assert sent == 2
        not_last = await mgr.disconnect(1, ws_a)
        assert not_last is False
        last = await mgr.disconnect(1, ws_b)
        assert last is True
        assert not mgr.is_online(1)

    asyncio.run(run())


def test_manager_reaps_dead_sockets():
    async def run():
        mgr = ConnectionManager()
        ws = _FakeSocket()
        await mgr.connect(7, ws)
        await ws.close()
        delivered = await mgr.send_to(7, {"type": "x"})
        assert delivered == 0
        assert not mgr.is_online(7)

    asyncio.run(run())


# ---------------------------------------------------------------------------
# WebSocket and REST end-to-end tests
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    return TestClient(app_module.app)


def test_ws_rejects_bad_token(client):
    with client.websocket_connect("/api/chat/ws?token=garbage") as ws:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            ws.receive_json()
    assert exc_info.value.code == 4401


def test_ws_send_message_round_trip(client, two_users):
    alice, bob = two_users
    a_token = _make_token(alice.id)
    b_token = _make_token(bob.id)

    with client.websocket_connect(f"/api/chat/ws?token={a_token}") as a_ws:
        with client.websocket_connect(f"/api/chat/ws?token={b_token}") as b_ws:
            a_hello = a_ws.receive_json()
            assert a_hello["type"] == "hello"
            b_hello = b_ws.receive_json()
            assert b_hello["type"] == "hello"
            a_presence = a_ws.receive_json()
            assert a_presence == {
                "type": "presence",
                "user_id": bob.id,
                "online": True,
            }

            a_ws.send_json({"type": "send", "to": bob.id, "body": "hi bob"})

            a_echo = a_ws.receive_json()
            b_recv = b_ws.receive_json()
            for frame in (a_echo, b_recv):
                assert frame["type"] == "message"
                assert frame["from"] == alice.id
                assert frame["to"] == bob.id
                assert frame["body"] == "hi bob"


def test_history_endpoint_returns_oldest_first(client, two_users, db):
    alice, bob = two_users
    now = datetime.now(timezone.utc)
    rows = [
        ChatMessage(sender_id=alice.id, recipient_id=bob.id, body="one", created_at=now),
        ChatMessage(
            sender_id=bob.id,
            recipient_id=alice.id,
            body="two",
            created_at=now + timedelta(seconds=1),
        ),
        ChatMessage(
            sender_id=alice.id,
            recipient_id=bob.id,
            body="three",
            created_at=now + timedelta(seconds=2),
        ),
    ]
    db.add_all(rows)
    db.commit()

    token = _make_token(alice.id)
    res = client.get(
        f"/api/chat/messages?with={bob.id}&limit=10",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    bodies = [m["body"] for m in res.json()]
    assert bodies == ["one", "two", "three"]


def test_history_requires_auth(client, two_users):
    _, bob = two_users
    res = client.get(f"/api/chat/messages?with={bob.id}")
    assert res.status_code in (401, 403)


def test_search_users_excludes_self(client, two_users):
    alice, bob = two_users
    token = _make_token(alice.id)
    res = client.get(
        "/api/chat/users/search?q=morgan",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    ids = {u["id"] for u in res.json()}
    assert alice.id not in ids
    assert bob.id in ids
