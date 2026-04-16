"""LLM client wrapper for BearBoard AI agents.

Supports Anthropic (preferred) and OpenAI. When no API key is configured the
client returns a stub response so the app still boots in dev without keys.
"""

import os
from typing import Optional

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic").lower()

ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class LLMUnavailable(Exception):
    pass


def _call_anthropic(system: str, user: str, max_tokens: int = 400) -> str:
    try:
        import anthropic
    except ImportError as e:
        raise LLMUnavailable("anthropic package not installed") from e

    if not ANTHROPIC_API_KEY:
        raise LLMUnavailable("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return resp.content[0].text


def _call_openai(system: str, user: str, max_tokens: int = 400) -> str:
    try:
        from openai import OpenAI
    except ImportError as e:
        raise LLMUnavailable("openai package not installed") from e

    if not OPENAI_API_KEY:
        raise LLMUnavailable("OPENAI_API_KEY not set")

    client = OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return resp.choices[0].message.content or ""


def complete(system: str, user: str, max_tokens: int = 400) -> str:
    """Run a single-turn completion. Raises LLMUnavailable if no provider works."""
    providers = [LLM_PROVIDER] + [p for p in ["anthropic", "openai"] if p != LLM_PROVIDER]
    last_error: Optional[Exception] = None
    for provider in providers:
        try:
            if provider == "anthropic":
                return _call_anthropic(system, user, max_tokens=max_tokens)
            if provider == "openai":
                return _call_openai(system, user, max_tokens=max_tokens)
        except LLMUnavailable as e:
            last_error = e
            continue
    raise LLMUnavailable(str(last_error) if last_error else "no LLM provider configured")


def is_configured() -> bool:
    return bool(ANTHROPIC_API_KEY or OPENAI_API_KEY)
