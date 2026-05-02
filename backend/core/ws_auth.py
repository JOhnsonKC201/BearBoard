"""Shared JWT decoding for HTTP and WebSocket auth paths.

The HTTP path (`get_current_user_dep` in `routers.auth`) and the WebSocket
path (`routers.chat`) need to validate the same JWT but cannot share a
FastAPI dependency: WebSockets do not support `Depends(HTTPBearer())` and
the browser WebSocket API cannot set the `Authorization` header. The
WebSocket path therefore reads `?token=` from the query string and calls
into this helper directly.
"""

from jose import jwt, JWTError

from core.config import SECRET_KEY, ALGORITHM


class InvalidToken(Exception):
    """Raised when a JWT cannot be decoded or has no valid `sub` claim."""


def decode_jwt_user_id(token: str) -> int:
    """Return the integer user id encoded in `token`'s `sub` claim.

    Raises `InvalidToken` for any failure mode (missing token, bad
    signature, expired, non-integer subject). The HTTP layer maps this to
    HTTP 401; the WebSocket layer maps it to a 4401 close.
    """
    if not token:
        raise InvalidToken("missing token")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise InvalidToken(str(exc)) from exc

    sub = payload.get("sub")
    if sub is None:
        raise InvalidToken("missing sub")
    try:
        return int(sub)
    except (TypeError, ValueError) as exc:
        raise InvalidToken("non-integer sub") from exc
