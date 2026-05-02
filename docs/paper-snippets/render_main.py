"""
Render ONE clean, paper-ready PNG of the most important snippet:
the WebSocket endpoint that performs the RFC 6455 HTTP Upgrade.

This is the snippet your paper actually needs. It shows:
  - the FastAPI @router.websocket decorator (HTTP -> WS upgrade)
  - JWT auth via the ?token= query param
  - the handshake itself (await websocket.accept())
  - a 4401 close code on auth failure (per-app code in 4000-4999 range)

Output: docs/paper-snippets/main_snippet.png
"""
from pathlib import Path
from pygments import highlight
from pygments.formatters import ImageFormatter
from pygments.lexers import PythonLexer

OUT = Path(__file__).parent / "main_snippet.png"

# Kept short and self-contained on purpose — every line earns its place.
CODE = '''# routers/chat.py
# The WebSocket endpoint. RFC 6455 handshake happens at accept().

@router.websocket("/ws")
async def chat_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    # 1. HTTP -> WebSocket upgrade (the "101 Switching Protocols").
    await websocket.accept()

    # 2. Auth the connection. Browsers can't set the Authorization
    #    header on a WS, so we accept the JWT in the query string.
    try:
        user_id = decode_jwt_user_id(token or "")
    except InvalidToken:
        await websocket.close(code=4401)
        return

    # 3. Register the live socket with the in-process manager and
    #    tell every other online user that this one just came on.
    await manager.connect(user_id, websocket)
    for peer_id in manager.online_users():
        if peer_id != user_id:
            await manager.send_to(peer_id, {
                "type": "presence",
                "user_id": user_id,
                "online": True,
            })

    # 4. Read frames until the client disconnects.
    while True:
        frame = await websocket.receive_json()
        await _handle_inbound(user_id, frame, websocket)
'''

formatter = ImageFormatter(
    font_name="Consolas",
    font_size=20,
    line_numbers=True,
    line_number_bg="#0B1D34",
    line_number_fg="#7a8294",
    line_number_pad=12,
    image_pad=24,
    line_pad=6,
    style="monokai",
    image_format="PNG",
)

OUT.write_bytes(highlight(CODE, PythonLexer(), formatter))
print(f"wrote {OUT}  ({OUT.stat().st_size // 1024} KB)")
