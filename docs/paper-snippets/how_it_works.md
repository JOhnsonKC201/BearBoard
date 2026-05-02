# How BearChat actually works (plain-English notes for the paper)

Hey Victor, this is the writeup of the chat system. You can lift any of this
into the paper directly, paraphrase it, or just use it as background. The
matching code image is `main_snippet.png` in this folder.

## The big picture in one paragraph

Every browser that opens BearChat keeps one persistent connection to the
backend. We call it a WebSocket. It's a TCP connection that started life as a
normal HTTP request and got "upgraded" mid-flight into a long-lived
two-way pipe. Once it's open, either side can send a message at any time
without polling. When student A sends a chat message, the server saves it to
Postgres, then pushes it down student B's pipe in milliseconds.

## The handshake (RFC 6455)

A WebSocket connection doesn't start out as a WebSocket. It starts as a
regular HTTP GET. The browser asks the server "hey, would you like to
upgrade this HTTP connection into a WebSocket?" by sending a few special
headers:

```
GET /api/chat/ws?token=<JWT> HTTP/1.1
Host: localhost:8000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: <random base64>
Sec-WebSocket-Version: 13
```

If the server agrees, it responds:

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: <hash of the client's key>
```

That `101 Switching Protocols` response is the handshake completing. From
that moment on, the same TCP socket carries WebSocket frames instead of
HTTP. In our FastAPI code that handshake is the single line
`await websocket.accept()`. Underneath, the framework reads those headers,
computes the expected `Sec-WebSocket-Accept` hash, and sends the 101
response.

## Authentication on the wire

Browsers can't set custom HTTP headers on a WebSocket connection (the
JavaScript `WebSocket` constructor doesn't expose that knob). So we put the
JWT in the query string instead: `?token=<JWT>`. The server reads it, decodes
it with the same key it uses for the REST API, and looks up the user. If the
token is invalid, the server closes the WebSocket with the application close
code 4401 (the WebSocket spec reserves codes 4000 through 4999 for app-level
use, and we picked 4401 to mirror HTTP 401 Unauthorized).

This trade-off is honest in the paper: tokens in URLs can leak into proxy
logs. We mitigate that by using short-lived tokens (24 hours) and TLS-only
in production. A heavier app would mint a one-time WebSocket ticket via a
REST call first, but for our scope a query-param JWT is acceptable and
matches what Slack, Discord, and several others did at our scale.

## Fan-out (one sender, many sockets)

A user can have BearChat open in two browser tabs at once, or on a laptop
and a phone. So the server doesn't track "user X has a socket"; it tracks
"user X has a set of sockets." That data structure lives in a class called
`ConnectionManager`. When user A sends a message to user B, the server:

1. Looks up B's set of live sockets.
2. Writes the message to Postgres so the conversation persists.
3. Pushes the message down each of B's sockets so all their devices light
   up at once. Then it echoes the message back to A's sockets too, so A's
   other tabs stay in sync.

If user B has zero sockets open (offline), step 3 finds an empty set and
no live delivery happens. The message still got saved in step 2, plus we
queue a notification row so the bell icon flashes when B comes back.

## Presence (online / offline / last seen)

The same `ConnectionManager` answers "is user X online?" with a single
dictionary lookup. When a user opens their first tab, we broadcast a
`presence` frame to every other online user saying "X is online." When
their last tab closes, we stamp a `last_seen` timestamp and broadcast
"X is offline, last seen at this ISO timestamp." That's how the chat
header shows "Active 22 minutes ago."

## Why not just poll?

The paper's section 3.4 compares this to HTTP polling. The contrast is
worth spelling out concretely:

- Polling means the browser asks the server "any new messages?" every few
  seconds. A 5-second interval with 100 active users is 1,200 wasted
  requests per minute when nothing's happening.
- WebSocket means each user costs the server one open connection. Memory
  is cheap; redundant requests aren't. When something happens, the server
  pushes once, immediately. The latency between "send" and "delivered" is
  network round-trip time, not "up to the polling interval."

For real-time chat, polling is the wrong tool because the cost scales with
users, not with activity. WebSockets scale with activity.

## What the paper can claim about our build

You can confidently say all of these in the paper because they were verified
end-to-end:

- The server completes a real RFC 6455 upgrade handshake (101 Switching
  Protocols).
- Authentication closes invalid tokens with code 4401 instead of leaking
  state.
- Messages persist in Postgres before they fan out, so the conversation
  history survives a refresh, a server restart, and an offline period.
- The connection stays alive across 25-second heartbeats and reconnects
  with exponential backoff if the network blips.
- A bad frame from one client doesn't kill that client's socket, let alone
  affect anyone else's.
- Presence and last-seen state are derived from the live socket map, so
  they're always consistent with reality.

If the audit script (`backend/tests/audit_chat.py`) is rerun before the
demo, those claims can be re-verified live.
