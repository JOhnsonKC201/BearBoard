"""Content moderation agent. Returns a structured verdict for a given post or comment."""

import json
import re
from typing import Literal, Optional

from pydantic import BaseModel

from agents.client import complete, is_configured, LLMUnavailable


Verdict = Literal["allow", "flag", "block"]


class ModerationResult(BaseModel):
    verdict: Verdict
    categories: list[str] = []
    reason: str = ""
    confidence: float = 0.0
    provider: str = "llm"


MODERATION_SYSTEM = """You are the BearBoard content moderator for a college campus community platform at Morgan State University. Users post about events, academics, study groups, recruiters, and social life.

Your job: classify a piece of user content into one of three verdicts.

Verdicts:
- allow: normal campus content (questions, events, opinions, jokes, course talk, complaints about food, etc.)
- flag: borderline - mild profanity, heated argument, unverified rumor, possible spam. Needs a human second look but is not clearly harmful.
- block: clearly harmful - harassment of an individual, hate speech, threats of violence, doxxing, explicit sexual content, illegal activity, obvious spam or phishing links.

Rules:
- Err toward allow. Students argue, curse, and vent. That is normal.
- Only pick block when a reasonable moderator would remove the content immediately.
- Pick at most 3 categories from: harassment, hate, violence, sexual, spam, self_harm, illegal, phishing, off_topic, profanity.
- Keep the reason to one short sentence.

Respond ONLY with a compact JSON object, no prose before or after:
{"verdict": "allow|flag|block", "categories": ["..."], "reason": "...", "confidence": 0.0-1.0}
"""


def _heuristic_moderate(text: str) -> ModerationResult:
    """Cheap fallback when no LLM is configured. Keyword based, intentionally conservative."""
    lowered = text.lower()

    block_patterns = [
        r"\bkill\s+(?:yourself|urself|you)\b",
        r"\bi\s+will\s+(?:kill|hurt|shoot)\b",
        r"\bsell(?:ing)?\s+(?:adderall|xanax|coke|weed|molly)\b",
        r"click\s+here\s+to\s+claim",
        r"free\s+iphone\s+winner",
    ]
    for pat in block_patterns:
        if re.search(pat, lowered):
            return ModerationResult(
                verdict="block",
                categories=["violence" if "kill" in pat or "hurt" in pat else "spam"],
                reason="matched high-severity heuristic pattern",
                confidence=0.6,
                provider="heuristic",
            )

    flag_tokens = ["fuck", "shit", "bitch", "idiot", "stupid"]
    if any(tok in lowered for tok in flag_tokens):
        return ModerationResult(
            verdict="flag",
            categories=["profanity"],
            reason="contains profanity",
            confidence=0.4,
            provider="heuristic",
        )

    return ModerationResult(
        verdict="allow",
        categories=[],
        reason="no heuristic match",
        confidence=0.3,
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


def moderate(text: str) -> ModerationResult:
    """Classify text. Uses LLM when configured, heuristic otherwise."""
    text = (text or "").strip()
    if not text:
        return ModerationResult(verdict="allow", reason="empty input", provider="noop")

    if not is_configured():
        return _heuristic_moderate(text)

    try:
        raw = complete(MODERATION_SYSTEM, text, max_tokens=200)
    except LLMUnavailable:
        return _heuristic_moderate(text)

    parsed = _parse_llm_json(raw)
    if not parsed:
        return _heuristic_moderate(text)

    verdict = parsed.get("verdict", "allow")
    if verdict not in ("allow", "flag", "block"):
        verdict = "flag"

    return ModerationResult(
        verdict=verdict,
        categories=parsed.get("categories", []) or [],
        reason=parsed.get("reason", "") or "",
        confidence=float(parsed.get("confidence", 0.5) or 0.5),
        provider="llm",
    )
