from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from agents import moderation, summarize as summarize_agent, insights as insights_agent
from core.database import get_db
from core.rate_limit import limiter
from models.comment import Comment
from models.post import Post
from models.user import User
from routers.auth import get_current_user_dep
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

    comments = sorted(post.comments or [], key=lambda c: c.created_at or 0)
    flat = [
        ((c.author.name if c.author else None) or "anon", c.body)
        for c in comments
    ]
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
