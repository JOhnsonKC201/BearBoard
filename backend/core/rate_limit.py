"""Shared rate limiter for the API.

Uses slowapi (Starlette/FastAPI adapter for limits) with per-IP in-memory
buckets. Fine for a single-process dev deployment; swap in a Redis backend
(`storage_uri="redis://..."`) before scaling horizontally.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
