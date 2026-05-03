"""Daily request budget for paid LLM calls.

Hard ceiling on how many times the backend will hit a paid LLM provider
(Anthropic primary, Gemini fallback) per UTC day. When the cap is hit,
`try_consume()` returns False and callers fall through to their existing
deterministic / heuristic paths — every AI agent in this codebase already
has one. The user-visible failure mode is "AI features stop being smart
for the rest of the day," never a 500.

Storage is an in-process dict keyed by UTC date — fine for a single
Render instance. If we ever scale horizontally we'll need Redis (same
caveat as core/rate_limit.py).

Tunable via env:
- AI_DAILY_REQUEST_LIMIT (int, default 500)
- AI_BUDGET_DISABLED      (truthy → bypass entirely; useful for tests)
"""
from __future__ import annotations

import os
import threading
from datetime import datetime, timezone

_DEFAULT_LIMIT = 500


def _limit() -> int:
    raw = os.getenv("AI_DAILY_REQUEST_LIMIT", "")
    try:
        n = int(raw) if raw else _DEFAULT_LIMIT
    except ValueError:
        n = _DEFAULT_LIMIT
    return max(0, n)


def _disabled() -> bool:
    return os.getenv("AI_BUDGET_DISABLED", "").lower() in ("1", "true", "yes")


_lock = threading.Lock()
_state: dict[str, int] = {}  # {"YYYY-MM-DD": count}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def try_consume(n: int = 1) -> bool:
    """Reserve n requests against today's budget. Returns True if granted,
    False if the cap would be exceeded. Atomic under the module lock."""
    if _disabled():
        return True
    cap = _limit()
    if cap <= 0:
        return False
    with _lock:
        day = _today()
        current = _state.get(day, 0)
        if current + n > cap:
            return False
        _state[day] = current + n
        # Garbage-collect old days so the dict can't grow unbounded.
        if len(_state) > 7:
            for k in list(_state.keys()):
                if k != day:
                    _state.pop(k, None)
        return True


def is_exhausted() -> bool:
    """Cheap read-only check — does NOT reserve. Useful for short-circuiting
    SSE streams before opening a connection to the provider."""
    if _disabled():
        return False
    cap = _limit()
    if cap <= 0:
        return True
    with _lock:
        return _state.get(_today(), 0) >= cap


def snapshot() -> dict:
    """Diagnostic view for /api/ai/health."""
    if _disabled():
        return {"disabled": True}
    with _lock:
        return {
            "date": _today(),
            "used": _state.get(_today(), 0),
            "limit": _limit(),
        }
