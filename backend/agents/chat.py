"""Chat agent for the BearBoard Assistant widget.

Open-ended student Q&A about BearBoard features and Morgan State campus
life. Falls back to a deterministic keyword router when no LLM provider
is configured so the widget never returns an empty / error response.

Tone target: peer-to-peer, concise, hedged when uncertain. We
intentionally avoid making up specific dates, prices, or office phone
numbers — students will trust the bot exactly as much as the worst
hallucination they catch it on.
"""

from typing import Optional

from pydantic import BaseModel

from agents.client import complete, is_configured, LLMUnavailable


class ChatReply(BaseModel):
    reply: str
    provider: str = "llm"


# Stub responses for the no-LLM path. Kept here (vs. the router) so the
# fallback lives next to the same code that decides when to use it.
# Order-sensitive: longer/more specific keys should sit above shorter
# ones so "create a post" wins over a bare "post".
_STUB_KEYWORDS: list[tuple[tuple[str, ...], str]] = [
    (
        ("event", "events", "happening"),
        "Check the **Events** tab for what's on this week. Add an event by creating a post in the *Events* category and filling in a date + time.",
    ),
    (
        ("study group", "study groups"),
        "Browse the **Groups** tab for active study groups. Create one with **+ New Group** if your class isn't there yet — name, course code, short description.",
    ),
    (
        ("trending", "popular", "top post"),
        "The **Trending** widget on the right rail shows the most active posts in the last 48 hours. Switch the feed sort to *Popular* to see the all-time top posts.",
    ),
    (
        ("create a post", "new post", "post a", "how do i post"),
        "Hit **+ New Post** in the right rail. Pick a category, write a title and body, optionally drop in an image (drag-and-drop or click to upload), then **Publish**.",
    ),
    (
        ("anonymous",),
        "Pick the **Anonymous** category when you create a post. Your name and avatar are stripped from the public view but moderators can still investigate abuse.",
    ),
    (
        ("vote", "upvote", "downvote"),
        "Use the ▲ / ▼ arrows on each post or comment. You need to be logged in. Voting is what powers the *Best* sort on comments and the *Popular* sort on the feed.",
    ),
    (
        ("sos", "emergency"),
        "Toggle **SOS** when you create a post — it pins to the top of the feed and notifies students who share your major. There's a 1-per-6h limit so it stays meaningful.",
    ),
]

_GENERIC_FALLBACK = (
    "I'm not sure about that one yet. Try asking about **events**, **study groups**, "
    "**trending posts**, **anonymous posts**, **voting**, or **SOS**. Once the AI is "
    "fully online I'll be able to answer anything about campus life."
)


def _stub_reply(message: str) -> ChatReply:
    lowered = (message or "").lower()
    for keys, reply in _STUB_KEYWORDS:
        if any(k in lowered for k in keys):
            return ChatReply(reply=reply, provider="heuristic")
    return ChatReply(reply=_GENERIC_FALLBACK, provider="heuristic")


CHAT_SYSTEM = """You are BearBoard Assistant, the in-app helper for Morgan State University students using BearBoard.

What BearBoard is:
- A campus social board: feed of posts, threaded comments, voting, study groups, events, professor reviews, campus map.
- Categories include General, Academic, Events, Housing, Swap, Safety, Anonymous, Memes, Advice, Lost & Found, Admissions.
- Features: per-post and per-comment voting, threaded replies (depth-1), drag-and-drop image upload, emoji picker, SOS posts that notify students in the same major, custom user avatars.

Answer the student in 1-3 short paragraphs. Use markdown bold for the names of UI elements and tabs. Be concrete and direct.

Hard rules:
- Do NOT invent specific event dates, prices, professor names, room numbers, or office phone numbers. If asked for one, say you don't have that exact info and suggest where on BearBoard or campus to check.
- Hedge when unsure ("worth checking with the Registrar" rather than "the Registrar will do X").
- Stay in scope: BearBoard features and Morgan State campus life. Politely redirect off-topic asks back to those.
- No corporate disclaimers, no "I cannot give advice." Peer-to-peer voice.

Known Morgan State offices you may reference by name when relevant:
Registrar, Financial Aid Office, Bear Success Center, Career Center, Bursar, Counseling Center, Housing Office.
"""

MAX_INPUT_CHARS = 1200


def _truncate(text: str, limit: int = MAX_INPUT_CHARS) -> str:
    return text if len(text) <= limit else text[:limit] + "\n[...truncated...]"


def reply(message: str) -> ChatReply:
    """Generate a single-turn response for the chat widget.

    Always returns a ChatReply — never raises. When the LLM is
    unconfigured or the call fails the keyword stub takes over so the
    widget always shows something useful.
    """
    cleaned = _truncate((message or "").strip())
    if not cleaned:
        return ChatReply(
            reply="What's up? Ask me about events, study groups, trending posts, or anything on BearBoard.",
            provider="noop",
        )

    if not is_configured():
        return _stub_reply(cleaned)

    try:
        raw = complete(CHAT_SYSTEM, cleaned, max_tokens=180)
    except LLMUnavailable:
        return _stub_reply(cleaned)

    text = (raw or "").strip()
    if not text:
        return _stub_reply(cleaned)

    return ChatReply(reply=text, provider="llm")
