"""
Full audit of BearChat. Run with:
    cd C:\\BearBoard\\backend
    set BEARCHAT_AUDIT_EMAIL=you@morgan.edu
    set BEARCHAT_AUDIT_PASSWORD=yourpassword
    python tests/audit_chat.py

Or on Mac/Linux:
    BEARCHAT_AUDIT_EMAIL=you@morgan.edu \
    BEARCHAT_AUDIT_PASSWORD=yourpassword \
    python tests/audit_chat.py

The script needs ONE real account to log in as so it can exercise the
authenticated endpoints. Credentials are read from env vars so the file
is safe to commit. A second user is registered fresh each run.
"""
import asyncio
import json
import os
import sys
import time

import requests
from urllib.parse import quote
import websockets

API = "http://localhost:8000"
WS = "ws://localhost:8000"
REAL_EMAIL = os.getenv("BEARCHAT_AUDIT_EMAIL", "")
REAL_PASSWORD = os.getenv("BEARCHAT_AUDIT_PASSWORD", "")


def ok(label):
    print(f"  PASS  {label}")


def fail(label, why):
    print(f"  FAIL  {label}  ({why})")


def main():
    print("=== BearChat full audit ===\n")

    if not REAL_EMAIL or not REAL_PASSWORD:
        sys.exit(
            "error: set BEARCHAT_AUDIT_EMAIL and BEARCHAT_AUDIT_PASSWORD env "
            "vars before running this script. See the docstring at the top."
        )
    r = requests.post(
        f"{API}/api/auth/login",
        json={"email": REAL_EMAIL, "password": REAL_PASSWORD},
        timeout=10,
    )
    if r.status_code != 200:
        sys.exit(f"error: login failed for {REAL_EMAIL} (status {r.status_code})")
    real_token = r.json()["access_token"]
    real_id = requests.get(
        f"{API}/api/auth/me", headers={"Authorization": f"Bearer {real_token}"}
    ).json()["id"]

    peer_email = f"audit2_{int(time.time())}@morgan.edu"
    requests.post(
        f"{API}/api/auth/register",
        json={"email": peer_email, "password": "AuditPass99!!", "name": "Audit Two"},
    )
    peer_token = requests.post(
        f"{API}/api/auth/login",
        json={"email": peer_email, "password": "AuditPass99!!"},
    ).json()["access_token"]
    peer_id = requests.get(
        f"{API}/api/auth/me", headers={"Authorization": f"Bearer {peer_token}"}
    ).json()["id"]
    print(f"real user id={real_id}, peer id={peer_id}\n")

    print("[1] WebSocket auth")

    async def t1():
        try:
            async with websockets.connect(f"{WS}/api/chat/ws?token=garbage") as ws:
                try:
                    await asyncio.wait_for(ws.recv(), timeout=2)
                    fail("bad token rejection", "no close")
                except websockets.exceptions.ConnectionClosed as e:
                    if e.code == 4401:
                        ok("bad token closes 4401")
                    else:
                        fail("bad token close code", f"got {e.code}")
        except Exception as e:
            fail("bad token rejection", str(e))

    asyncio.run(t1())

    print("\n[2] Live two-client session")

    async def t2():
        a = await websockets.connect(f"{WS}/api/chat/ws?token={quote(real_token)}")
        b = await websockets.connect(f"{WS}/api/chat/ws?token={quote(peer_token)}")

        async def recv(ws):
            return json.loads(await asyncio.wait_for(ws.recv(), timeout=3))

        a_hello = await recv(a)
        b_hello = await recv(b)
        if a_hello.get("type") == "hello":
            ok("a hello frame")
        else:
            fail("a hello frame", a_hello)
        if b_hello.get("type") == "hello":
            ok("b hello frame")
        else:
            fail("b hello frame", b_hello)

        a_pres = await recv(a)
        if (
            a_pres.get("type") == "presence"
            and a_pres.get("online") is True
            and a_pres.get("user_id") == peer_id
        ):
            ok("presence broadcast on connect")
        else:
            fail("presence broadcast on connect", a_pres)

        await a.send(json.dumps({"type": "send", "to": peer_id, "body": "audit hi"}))
        a_echo = await recv(a)
        b_recv = await recv(b)
        if a_echo.get("body") == "audit hi" and a_echo.get("from") == real_id:
            ok("send echoes to sender")
        else:
            fail("send echo", a_echo)
        if b_recv.get("body") == "audit hi" and b_recv.get("from") == real_id:
            ok("send delivers to recipient")
        else:
            fail("send delivery", b_recv)

        await a.send(json.dumps({"type": "typing", "to": peer_id}))
        b_typ = await recv(b)
        if b_typ.get("type") == "typing" and b_typ.get("from") == real_id:
            ok("typing indicator forwarded")
        else:
            fail("typing forwarded", b_typ)

        await b.send(json.dumps({"type": "read", "with": real_id}))
        a_read = await recv(a)
        if a_read.get("type") == "read" and a_read.get("by") == peer_id:
            ok("read receipt forwarded")
        else:
            fail("read receipt forwarded", a_read)

        await a.send(json.dumps({"type": "ping"}))
        pong = await recv(a)
        if pong.get("type") == "pong":
            ok("ping/pong heartbeat")
        else:
            fail("ping/pong", pong)

        await a.send(json.dumps({"type": "badtype"}))
        err = await recv(a)
        if err.get("type") == "error":
            ok("unknown frame returns error (does not crash)")
        else:
            fail("unknown frame error", err)
        await a.send(json.dumps({"type": "ping"}))
        pong2 = await recv(a)
        if pong2.get("type") == "pong":
            ok("connection stays alive after bad frame")
        else:
            fail("connection alive after bad frame", pong2)

        await b.close()
        await asyncio.sleep(0.3)
        a_off = await recv(a)
        if (
            a_off.get("type") == "presence"
            and a_off.get("online") is False
            and a_off.get("user_id") == peer_id
        ):
            ok("presence broadcast on disconnect")
        else:
            fail("presence broadcast on disconnect", a_off)

        await a.send(
            json.dumps({"type": "send", "to": peer_id, "body": "while offline"})
        )
        a_echo2 = await recv(a)
        if a_echo2.get("body") == "while offline":
            ok("send-to-offline succeeds (no crash)")
        else:
            fail("send-to-offline echo", a_echo2)

        await a.send(json.dumps({"type": "ping"}))
        pong3 = await recv(a)
        if pong3.get("type") == "pong":
            ok("connection alive after offline send")
        else:
            fail("connection alive after offline send", pong3)

        await a.close()

    asyncio.run(t2())

    print("\n[3] REST endpoints")
    H = {"Authorization": f"Bearer {real_token}"}

    r = requests.get(f"{API}/api/chat/conversations", headers=H)
    if r.status_code == 200 and isinstance(r.json(), list):
        ok(f"GET /conversations -> {len(r.json())} threads")
    else:
        fail("GET /conversations", f"status {r.status_code}")

    r = requests.get(f"{API}/api/chat/messages?with={peer_id}&limit=10", headers=H)
    if r.status_code == 200 and isinstance(r.json(), list):
        ok(f"GET /messages -> {len(r.json())} messages")
    else:
        fail("GET /messages", f"status {r.status_code}")

    r = requests.post(
        f"{API}/api/chat/messages/read", headers=H, json={"with": peer_id}
    )
    if r.status_code in (200, 204):
        ok(f"POST /messages/read -> {r.status_code}")
    else:
        fail("POST /messages/read", f"status {r.status_code}")

    r = requests.get(f"{API}/api/chat/users/search?q=Audit", headers=H)
    if r.status_code == 200 and len(r.json()) >= 1:
        ok(f"GET /users/search -> {len(r.json())} hits")
    else:
        fail("GET /users/search", f"status {r.status_code} body {r.text[:80]}")

    r = requests.get(f"{API}/api/chat/presence", headers=H)
    if r.status_code == 200 and "online_user_ids" in r.json():
        ok(f"GET /presence -> online={r.json()['online_user_ids']}")
    else:
        fail("GET /presence", f"status {r.status_code}")

    r = requests.get(f"{API}/api/chat/conversations")
    if r.status_code in (401, 403):
        ok(f"unauth /conversations -> {r.status_code}")
    else:
        fail("unauth gate", f"got {r.status_code}")

    print("\n[4] Pre-existing BearBoard endpoints (regression check)")
    for name, path in [
        ("auth/me", "/api/auth/me"),
        ("posts", "/api/posts?limit=5"),
        ("groups", "/api/groups"),
        ("events", "/api/events"),
        ("professors", "/api/professors?limit=3"),
        ("notifications/unread_count", "/api/notifications/unread_count"),
        ("stats", "/api/stats"),
    ]:
        r = requests.get(f"{API}{path}", headers=H, timeout=10)
        if r.status_code == 200:
            ok(f"{name} -> 200")
        else:
            fail(name, f"status {r.status_code}")

    print("\n=== AUDIT DONE ===")


if __name__ == "__main__":
    main()
