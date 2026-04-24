"""LLM client wrapper for BearBoard AI agents.

Primary provider is Google Gemini. Anthropic and OpenAI are optional
failovers if the Gemini call fails and their SDK + keys are present.
When no provider is configured, callers get LLMUnavailable and should
fall back to a deterministic path (e.g. the heuristic moderator).
"""

import os
from typing import Optional

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class LLMUnavailable(Exception):
    pass


def _call_gemini(system: str, user: str, max_tokens: int = 400) -> str:
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise LLMUnavailable("google-genai package not installed") from e

    if not GEMINI_API_KEY:
        raise LLMUnavailable("GEMINI_API_KEY not set")

    client = genai.Client(api_key=GEMINI_API_KEY)
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=0.2,
        ),
    )
    return resp.text or ""


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
    order = ["gemini", "anthropic", "openai"]
    providers = [LLM_PROVIDER] + [p for p in order if p != LLM_PROVIDER]
    last_error: Optional[Exception] = None
    for provider in providers:
        try:
            if provider == "gemini":
                return _call_gemini(system, user, max_tokens=max_tokens)
            if provider == "anthropic":
                return _call_anthropic(system, user, max_tokens=max_tokens)
            if provider == "openai":
                return _call_openai(system, user, max_tokens=max_tokens)
        except LLMUnavailable as e:
            last_error = e
            continue
    raise LLMUnavailable(str(last_error) if last_error else "no LLM provider configured")


def is_configured() -> bool:
    return bool(GEMINI_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY)
