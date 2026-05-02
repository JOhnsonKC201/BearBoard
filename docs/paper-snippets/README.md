# BearChat paper snippets

Five pre-rendered code images for the COSC 349 paper. Drop the PNGs straight
into the Word doc as figures. Suggested captions are in the matching
`.caption.txt` files.

## Where each image goes

| File | Paper section | What it shows |
| --- | --- | --- |
| `01_websocket_handshake.png` | 3.2 The WebSocket Protocol | The `@router.websocket("/ws")` endpoint and the `await websocket.accept()` line that performs the RFC 6455 HTTP Upgrade |
| `02_connection_manager.png` | 3.3 Real-Time Messaging Architecture | The `ConnectionManager` class showing the per-user socket map, fan-out via `send_to`, and presence via `is_online` |
| `03_send_handler.png` | 3.3 Real-Time Messaging Architecture | The send handler that persists to Postgres, queues a notification when the recipient is offline, and fans out the message live |
| `04_websocket_client.png` | 3.4 Comparison: WebSocket vs polling | Browser-side `new WebSocket(url)` with `onmessage` push handler. One persistent connection. Use this to contrast HTTP polling. |
| `05_chat_message_model.png` | 2.4 Database Schema (or 3.3) | The `chat_messages` table model with the two indexes that drive history pulls and unread-count lookups |

## Re-rendering

If the source code changes and Victor wants fresh images:

```
cd C:\BearBoard
python docs/paper-snippets/render_snippets.py
```

The script uses Pygments with the Monokai dark theme and Consolas at 18pt so
the images print cleanly at full width in a Word column.
