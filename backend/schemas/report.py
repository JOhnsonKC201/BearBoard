from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from models.report import REPORT_REASONS, REPORT_STATUSES


class ReportCreate(BaseModel):
    """Body for POST /api/posts/{post_id}/report."""

    reason: str = Field(min_length=1, max_length=40)
    # Optional free-form context. Cap mirrors comment body so abuse remains
    # bounded at the DB layer.
    note: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("reason")
    @classmethod
    def _check_reason(cls, v: str) -> str:
        normalized = (v or "").strip().lower()
        if normalized not in REPORT_REASONS:
            raise ValueError(
                f"Unknown reason. Allowed: {', '.join(REPORT_REASONS)}"
            )
        return normalized


class ReportResolve(BaseModel):
    """Body for POST /api/admin/reports/{id}/resolve."""

    # 'dismissed' = no action; 'actioned' = post was deleted or a warning was
    # issued (the resolution string captures which).
    status: Literal["dismissed", "actioned"]
    resolution: Optional[str] = Field(default=None, max_length=40)


class ReportPostBrief(BaseModel):
    """Minimal post snapshot included alongside a report so mods can triage
    without an extra round-trip. Only fields visible to mods appear here."""

    id: int
    title: str
    body: str
    category: str
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    is_anonymous: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReporterBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ReportResponse(BaseModel):
    id: int
    reason: str
    note: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    post: Optional[ReportPostBrief] = None
    reporter: Optional[ReporterBrief] = None
    # Aggregated count of reports against the same post — surfaces "this
    # post has 5 separate complaints" at a glance.
    post_report_count: int = 1

    class Config:
        from_attributes = True
