"""Post / thread summarization agent.

Given a post id (with comments) or a raw text blob, returns a short TL;DR
and a handful of key points. Used for the "catch me up" affordance on long
threads and for the daily digest that lands in a user's profile dossier.

Design:
- Single-shot Gemini call via agents.client.complete with provider failover.
- Deterministic fallback when no LLM is configured so the endpoint still
  returns something usable in dev (same philosophy as moderation).
- Caps input length before sending to the LLM — long threads can blow
  past a model's context window and rack up tokens. 6k chars is plenty
  for a 2-3 sentence summary.
"""

import json
import re
from typing import Optional

from pydantic import BaseModel

from agents.client import complete, is_configured, LLMUnavailable


class SummaryResult(BaseModel):
    tldr: str
    key_points: list[str] = []
    provider: str = "llm"


MAX_INPUT_CHARS = 6000

SUMMARIZE_SYSTEM = """You are the BearBoard thread summarizer for the Morgan State University campus board.

Given a post and its comment thread, produce a tight TL;DR plus 3-5 key points a student can scan in 10 seconds.

Rules:
- TL;DR must be 1-2 sentences, max 240 characters.
- Key points should capture: the core question or claim, the strongest answer or counter, any action items or deadlines, and any consensus.
- Do not invent facts. If the thread is short or has no comments, say so honestly in the TL;DR.
- Strip names from key points unless the person is a professor, dean, or official source — students expect peer posts to be semi-anonymous in summary.
- Use plain spoken-English student voice, not corporate-memo voice.

Respond ONLY with JSON, no prose before or after:
{"tldr": "...", "key_points": ["...", "..."]}
"""


def _truncate(text: str, limit: int = MAX_INPUT_CHARS) -> str:
    if len(text) <= limit:
        return text
    # Keep the head (post body) and the tail (latest replies). Middle is
    # usually the least informative in a long thread.
    head = text[: int(limit * 0.6)]
    tail = text[-int(limit * 0.4):]
    return f"{head}\n\n[... thread truncated ...]\n\n{tail}"


def _heuristic_summary(text: str) -> SummaryResult:
    """No-LLM fallback. Pulls the first sentence as TL;DR and the first
    few non-empty lines as key points so we never return an empty payload."""
    clean = (text or "").strip()
    if not clean:
        return SummaryResult(tldr="(empty post)", key_points=[], provider="noop")

    first_sentence = re.split(r"(?<=[.!?])\s+", clean, maxsplit=1)[0][:240]
    bullets = [line.strip("-•*  ") for line in clean.splitlines() if line.strip()]
    bullets = [b for b in bullets if b and b != first_sentence][:4]

    return SummaryResult(
        tldr=first_sentence or clean[:240],
        key_points=bullets,
        provider="heuristic",
    )


def _parse_llm_json(raw: str) -> Optional[dict]:
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def summarize(text: str) -> SummaryResult:
    """Run the summarizer. Uses Gemini when configured, heuristic otherwise."""
    text = _truncate((text or "").strip())
    if not text:
        return SummaryResult(tldr="(empty post)", provider="noop")

    if not is_configured():
        return _heuristic_summary(text)

    try:
        raw = complete(SUMMARIZE_SYSTEM, text, max_tokens=400)
    except LLMUnavailable:
        return _heuristic_summary(text)

    parsed = _parse_llm_json(raw)
    if not parsed:
        return _heuristic_summary(text)

    tldr = (parsed.get("tldr") or "").strip()
    key_points = [str(p).strip() for p in (parsed.get("key_points") or []) if str(p).strip()]

    if not tldr:
        return _heuristic_summary(text)

    return SummaryResult(tldr=tldr[:280], key_points=key_points[:6], provider="llm")


def format_post_for_summary(title: str, body: str, comments: list[tuple[str, str]]) -> str:
    """Flatten a post + comments into a single prompt payload.

    comments is a list of (author_name_or_blank, body) tuples. We keep
    author names in the flat text so the model can attribute, but the
    system prompt tells it to scrub student names from the output.
    """
    lines = [f"POST TITLE: {title}", f"POST BODY: {body}"]
    if comments:
        lines.append("")
        lines.append("COMMENTS:")
        for i, (author, body_text) in enumerate(comments, 1):
            who = author or "anon"
            lines.append(f"[{i}] {who}: {body_text}")
    return "\n".join(lines)
