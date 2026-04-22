from fastapi import APIRouter, Depends, HTTPException, Request

from agents import moderation
from core.rate_limit import limiter
from models.user import User
from routers.auth import get_current_user_dep
from schemas.ai import ModerateRequest, ModerateResponse

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


@router.get("/health")
def ai_health():
    from agents.client import is_configured
    return {"llm_configured": is_configured()}
