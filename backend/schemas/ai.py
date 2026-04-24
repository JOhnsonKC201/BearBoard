from pydantic import BaseModel, Field, model_validator


class ModerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)


class ModerateResponse(BaseModel):
    verdict: str
    categories: list[str] = []
    reason: str = ""
    confidence: float = 0.0
    provider: str = "llm"


class SummarizeRequest(BaseModel):
    """Either post_id OR text must be provided; post_id wins if both are sent."""
    post_id: int | None = None
    text: str | None = Field(default=None, max_length=8000)

    @model_validator(mode="after")
    def _one_of(self):
        if self.post_id is None and not (self.text and self.text.strip()):
            raise ValueError("Provide post_id or text")
        return self


class SummarizeResponse(BaseModel):
    tldr: str
    key_points: list[str] = []
    provider: str = "llm"


class InsightsRequest(BaseModel):
    post_id: int | None = None
    text: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def _one_of(self):
        if self.post_id is None and not (self.text and self.text.strip()):
            raise ValueError("Provide post_id or text")
        return self


class InsightsResponse(BaseModel):
    headline: str
    guidance: list[str] = []
    resources: list[str] = []
    provider: str = "llm"
