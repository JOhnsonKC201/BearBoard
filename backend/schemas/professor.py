from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

from schemas.post import AuthorInfo


class ProfessorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    department: Optional[str] = Field(default=None, max_length=100)

    @field_validator("name")
    @classmethod
    def _trim_name(cls, v: str) -> str:
        return (v or "").strip()


class RatingCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    difficulty: Optional[int] = Field(default=None, ge=1, le=5)
    would_take_again: Optional[bool] = None
    course_code: Optional[str] = Field(default=None, max_length=30)
    comment: Optional[str] = Field(default=None, max_length=2000)


class RatingResponse(BaseModel):
    id: int
    rating: int
    difficulty: Optional[int] = None
    would_take_again: Optional[bool] = None
    course_code: Optional[str] = None
    comment: Optional[str] = None
    user_id: int
    author: Optional[AuthorInfo] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfessorResponse(BaseModel):
    id: int
    name: str
    department: Optional[str] = None
    rating_count: int = 0
    avg_rating: Optional[float] = None
    avg_difficulty: Optional[float] = None
    would_take_again_pct: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfessorDetailResponse(ProfessorResponse):
    ratings: list[RatingResponse] = []
