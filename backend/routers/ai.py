from fastapi import APIRouter, HTTPException

from agents import moderation
from schemas.ai import ModerateRequest, ModerateResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/moderate", response_model=ModerateResponse)
def moderate_content(req: ModerateRequest):
    try:
        result = moderation.moderate(req.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"moderation failed: {e}")
    return ModerateResponse(**result.model_dump())


@router.get("/health")
def ai_health():
    from agents.client import is_configured
    return {"llm_configured": is_configured()}
