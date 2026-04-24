"""Insights / guidance agent.

Given a post or a free-form student question, returns practical
Morgan-State-aware guidance: what to do next, who to ask, relevant
campus resources, deadlines to watch. Intentionally opinionated —
students ask BearBoard because they want an answer, not a disclaimer.

This agent differs from summarize in that it *advises* rather than
condenses. When a post is an SOS or question-category ask, the frontend
can call this to render a "BearBoard bot suggests..." chip below the post.

Guardrails:
- Does not impersonate faculty, financial aid, or Bear Success staff.
  Every piece of advice is hedged as "worth checking" rather than "this
  is the rule."
- Refers to official office names where relevant (Registrar, Financial
  Aid, Bear Success Center, Career Center) rather than inventing
  channels.
- Falls back to a short deterministic hint when no LLM is configured.
"""

import json
import re
from typing import Optional

from pydantic import BaseModel

from agents.client import complete, is_configured, LLMUnavailable


class InsightResult(BaseModel):
    headline: str
    guidance: list[str] = []
    resources: list[str] = []
    provider: str = "llm"


MAX_INPUT_CHARS = 4000

INSIGHTS_SYSTEM = """You are the BearBoard guidance bot for Morgan State University students.

Given a post or student question, output actionable, Morgan-State-aware guidance.

Format of the response (JSON only, no prose around it):
{
  "headline": "one sentence that names what the student actually needs",
  "guidance": ["3-5 concrete steps, each a short sentence"],
  "resources": ["0-3 named campus offices or official channels worth contacting; empty list if none apply"]
}

Tone:
- Peer-to-peer. Direct. No corporate disclaimers. No 'I cannot give advice.'
- Hedge rules you are not sure about ("double-check with the Registrar") instead of asserting.
- If the question is just venting or social, say so in the headline and keep guidance light (e.g. suggest a relevant subreddit-style category or event).

Known Morgan State offices you may reference by name when relevant:
- Registrar (class registration, transcripts)
- Financial Aid Office (FAFSA, scholarships, awards)
- Bear Success Center / academic advising
- Career Center (resumes, internships, fairs)
- Bursar (billing, holds, payment plans)
- Counseling Center (mental health support)
- Housing Office (dorm issues, roommate matching)

Do NOT invent office names or phone numbers. Prefer 'check the Registrar' over 'call 410-555-XXXX'.

Never include more than 5 guidance items or 3 resources. Keep each item under 140 characters.
"""


def _truncate(text: str, limit: int = MAX_INPUT_CHARS) -> str:
    return text if len(text) <= limit else text[:limit] + "\n[...truncated...]"


def _heuristic_insight(text: str) -> InsightResult:
    """No-LLM fallback. Best-effort keyword routing to a relevant office."""
    lowered = (text or "").lower()
    if not lowered.strip():
        return InsightResult(
            headline="Not enough context to advise.",
            guidance=["Post with a bit more detail — title, what you tried, what went wrong."],
            resources=[],
            provider="noop",
        )

    buckets = [
        (("register", "registration", "enroll", "prereq", "drop", "add/drop"), "Registrar"),
        (("fafsa", "financial aid", "scholarship", "award"), "Financial Aid Office"),
        (("advisor", "advising", "degree plan", "audit"), "Bear Success Center"),
        (("resume", "internship", "career fair", "interview"), "Career Center"),
        (("bill", "bursar", "hold", "payment"), "Bursar"),
        (("mental health", "counsel", "stress", "anxious", "depressed"), "Counseling Center"),
        (("dorm", "roommate", "housing"), "Housing Office"),
    ]
    matched = [office for keys, office in buckets if any(k in lowered for k in keys)]

    return InsightResult(
        headline="Possible campus offices to check.",
        guidance=[
            "Skim the question once more and pull out the specific ask.",
            "If it's time-sensitive, tag the post as SOS so majors in your cohort see it.",
        ],
        resources=matched[:3],
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


def advise(text: str) -> InsightResult:
    text = _truncate((text or "").strip())
    if not text:
        return _heuristic_insight("")

    if not is_configured():
        return _heuristic_insight(text)

    try:
        raw = complete(INSIGHTS_SYSTEM, text, max_tokens=500)
    except LLMUnavailable:
        return _heuristic_insight(text)

    parsed = _parse_llm_json(raw)
    if not parsed:
        return _heuristic_insight(text)

    headline = (parsed.get("headline") or "").strip()
    guidance = [str(g).strip() for g in (parsed.get("guidance") or []) if str(g).strip()]
    resources = [str(r).strip() for r in (parsed.get("resources") or []) if str(r).strip()]

    if not headline:
        return _heuristic_insight(text)

    return InsightResult(
        headline=headline[:200],
        guidance=guidance[:5],
        resources=resources[:3],
        provider="llm",
    )
