import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from agents import moderation, summarize as summarize_agent, insights as insights_agent
from agents.summarize import SUMMARIZE_SYSTEM, MAX_INPUT_CHARS, _truncate, _heuristic_summary
from core.database import get_db
from core.rate_limit import limiter
from models.comment import Comment
from models.post import Post
from models.user import User
from routers.auth import get_current_user_dep
from core.ws_auth import decode_jwt_user_id, InvalidToken
from schemas.ai import (
    InsightsRequest,
    InsightsResponse,
    ModerateRequest,
    ModerateResponse,
    SummarizeRequest,
    SummarizeResponse,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


# Auth-gated + rate-limited because this endpoint may proxy to a paid LLM
# provider. Without both controls an attacker could drain the project's
# LLM budget with a trivial loop.
@router.post("/moderate", response_model=ModerateResponse)
@limiter.limit("10/minute")
def moderate_content(
    request: Request,
    req: ModerateRequest,
    current_user: User = Depends(get_current_user_dep),
):
    try:
        result = moderation.moderate(req.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"moderation failed: {e}")
    return ModerateResponse(**result.model_dump())


def _load_post_payload(post_id: int, db: Session) -> str:
    """Fetch a post + its comments and flatten into a prompt payload."""
    post = (
        db.query(Post)
        .options(joinedload(Post.author), joinedload(Post.comments).joinedload(Comment.author))
        .filter(Post.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # SECURITY: Anonymity contract has to hold even when the payload is
    # bound for an external LLM. For anonymous posts/comments we strip
    # the author name (the body content still ships — that's the point of
    # summarizing). Also: a named comment from the post's own author on
    # their own anonymous post would re-link them by name, so collapse
    # those to 'Anonymous' too.
    post_is_anon = (
        bool(getattr(post, "is_anonymous", False))
        or (post.category or "").lower() == "anonymous"
    )

    def _comment_author_label(c):
        if getattr(c, "is_anonymous", False):
            return "Anonymous"
        if post_is_anon and c.author_id == post.author_id:
            return "Anonymous"
        return (c.author.name if c.author else None) or "anon"

    comments = sorted(post.comments or [], key=lambda c: c.created_at or 0)
    flat = [(_comment_author_label(c), c.body) for c in comments]
    return summarize_agent.format_post_for_summary(
        title=post.title or "",
        body=post.body or "",
        comments=flat,
    )


@router.post("/summarize", response_model=SummarizeResponse)
@limiter.limit("15/minute")
def summarize_endpoint(
    request: Request,
    req: SummarizeRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    payload = _load_post_payload(req.post_id, db) if req.post_id else (req.text or "")
    try:
        result = summarize_agent.summarize(payload)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"summarize failed: {e}")
    return SummarizeResponse(**result.model_dump())


@router.post("/insights", response_model=InsightsResponse)
@limiter.limit("15/minute")
def insights_endpoint(
    request: Request,
    req: InsightsRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    payload = _load_post_payload(req.post_id, db) if req.post_id else (req.text or "")
    try:
        result = insights_agent.advise(payload)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"insights failed: {e}")
    return InsightsResponse(**result.model_dump())


@router.get("/health")
def ai_health():
    from agents.client import is_configured
    return {"llm_configured": is_configured()}


# --- SSE streaming summary ---
#
# EventSource on the browser side cannot set Authorization headers, so the
# token is accepted as a query param. The endpoint pulls the post + comments,
# streams Gemini token-by-token as SSE events, and falls through to the
# heuristic if Gemini fails. The frontend renders text live as it arrives.
@router.get("/summarize/stream")
def summarize_stream(post_id: int, token: str, db: Session = Depends(get_db)):
    try:
        user_id = decode_jwt_user_id(token)
    except InvalidToken:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    payload = _load_post_payload(post_id, db)
    truncated = _truncate(payload, MAX_INPUT_CHARS)

    def _sse_event(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    def _gen():
        # Heuristic fallback computed up front; we yield it if every provider fails.
        heuristic = _heuristic_summary(payload)

        # Friendly prose-only prompt — the JSON-only system prompt would emit
        # ugly partial tokens until the closing brace lands.
        stream_system = (
            "You are the BearBoard thread summarizer for the Morgan State "
            "campus board. Read the post and any comments, then write a "
            "tight 2-4 sentence TL;DR a student can read in 10 seconds. "
            "Plain spoken-English student voice. No headers, no preamble, "
            "no JSON — just the paragraph."
        )

        # Provider order from env, default Anthropic-first when configured.
        primary = os.getenv("LLM_PROVIDER", "gemini").lower()
        order = ["gemini", "anthropic"]
        providers = [primary] + [p for p in order if p != primary]

        provider_announced = False
        any_text = False
        last_err: Optional[Exception] = None

        for provider in providers:
            try:
                if provider == "anthropic":
                    a_key = os.getenv("ANTHROPIC_API_KEY", "")
                    if not a_key:
                        continue
                    import anthropic
                    a_client = anthropic.Anthropic(api_key=a_key)
                    a_model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
                    if not provider_announced:
                        yield _sse_event("provider", {"provider": "llm"})
                        provider_announced = True
                    with a_client.messages.stream(
                        model=a_model,
                        max_tokens=220,
                        system=stream_system,
                        messages=[{"role": "user", "content": truncated}],
                    ) as stream:
                        for delta_text in stream.text_stream:
                            if not delta_text:
                                continue
                            any_text = True
                            yield _sse_event("delta", {"text": delta_text})
                    if any_text:
                        yield _sse_event("done", {})
                        return

                elif provider == "gemini":
                    g_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
                    if not g_key:
                        continue
                    from google import genai
                    from google.genai import types
                    g_client = genai.Client(api_key=g_key)
                    g_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
                    if not provider_announced:
                        yield _sse_event("provider", {"provider": "llm"})
                        provider_announced = True
                    g_stream = g_client.models.generate_content_stream(
                        model=g_model,
                        contents=truncated,
                        config=types.GenerateContentConfig(
                            system_instruction=stream_system,
                            max_output_tokens=180,
                            temperature=0.2,
                        ),
                    )
                    for chunk in g_stream:
                        delta_text = getattr(chunk, "text", None) or ""
                        if not delta_text:
                            continue
                        any_text = True
                        yield _sse_event("delta", {"text": delta_text})
                    if any_text:
                        yield _sse_event("done", {})
                        return

            except Exception as e:
                last_err = e
                # Reset announcement so next provider can also announce if it succeeds.
                continue

        # All providers failed — fall through to the heuristic.
        if not provider_announced:
            yield _sse_event("provider", {"provider": "heuristic"})
        else:
            # We told the client this was an LLM call but no text came back.
            yield _sse_event("provider", {"provider": "heuristic"})
        yield _sse_event("delta", {"text": heuristic.tldr})
        for kp in heuristic.key_points:
            yield _sse_event("keypoint", {"text": kp})
        if last_err:
            yield _sse_event("error", {"detail": f"{type(last_err).__name__}: {last_err}"})
        yield _sse_event("done", {})

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
