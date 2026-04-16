from pydantic import BaseModel, Field


class ModerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)


class ModerateResponse(BaseModel):
    verdict: str
    categories: list[str] = []
    reason: str = ""
    confidence: float = 0.0
    provider: str = "llm"
