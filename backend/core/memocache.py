"""Tiny in-process TTL cache for expensive read-only endpoints.

Use for aggregation queries a lot of pages hit (leaderboard, site stats,
trending) where serving a value that's up to N seconds stale is fine.
Per-process memory only — not shared across workers — which is still a
>90% hit rate on the heavy queries under normal single-worker load.

Do NOT use this for user-scoped endpoints (posts filtered by author_id,
notifications, etc.) — the cache is shared across all callers.
FastAPI-injected `Session` dependencies are excluded from the cache key
automatically because SQLAlchemy sessions don't compare equal across
requests.
"""
from __future__ import annotations

import threading
import time
from functools import wraps
from typing import Callable


def ttl_cache(ttl_seconds: float) -> Callable:
    """Return value cache keyed by the callable's scalar arguments.

    - Positional arg or kwarg that's a primitive (int/str/bool/None/float)
      becomes part of the cache key.
    - Anything else (SQLAlchemy Session, User object, etc.) is skipped.
    """
    def deco(fn: Callable) -> Callable:
        store: dict = {}  # key -> (value, expires_at)
        lock = threading.Lock()

        def _key(args, kwargs) -> tuple:
            parts = []
            for a in args:
                if isinstance(a, (int, str, bool, float)) or a is None:
                    parts.append(a)
            for k in sorted(kwargs.keys()):
                v = kwargs[k]
                if isinstance(v, (int, str, bool, float)) or v is None:
                    parts.append((k, v))
            return tuple(parts)

        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = _key(args, kwargs)
            now = time.monotonic()
            # Fast path: fresh entry, no lock.
            entry = store.get(key)
            if entry and entry[1] > now:
                return entry[0]
            # Slow path: compute under lock so simultaneous cold hits
            # don't all thunder onto the DB.
            with lock:
                entry = store.get(key)
                if entry and entry[1] > time.monotonic():
                    return entry[0]
                value = fn(*args, **kwargs)
                store[key] = (value, time.monotonic() + ttl_seconds)
                return value

        def invalidate():
            with lock:
                store.clear()

        wrapper.invalidate = invalidate  # type: ignore[attr-defined]
        return wrapper

    return deco
