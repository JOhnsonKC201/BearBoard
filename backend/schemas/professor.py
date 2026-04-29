from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

from schemas.post import AuthorInfo


# String enums for the structured rating fields. Validated client + server
# so the DB never holds an out-of-vocab value (which would break filtering).
ATTENDANCE_VALUES = {"required", "not_required", "recommended"}
QUIZ_VALUES = {"none", "scheduled", "pop", "both"}
CURVES_VALUES = {"never", "as_needed", "always"}
WORKLOAD_VALUES = {"light", "moderate", "heavy"}
FORMAT_VALUES = {"in_person", "hybrid", "online"}
SIZE_VALUES = {"small", "medium", "large"}
RECOMMENDATION_VALUES = {"absolutely_yes", "yes", "only_if_no_choice", "never"}
EXAM_TYPE_VALUES = {
    "multiple_choice", "essay", "true_false", "written_problems",
    "take_home", "open_book", "online", "other",
}


def _enum_validator(allowed: set[str]):
    def _v(cls, v):
        if v is None or v == "":
            return None
        if v not in allowed:
            raise ValueError(f"must be one of: {', '.join(sorted(allowed))}")
        return v
    return _v


class ProfessorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    department: Optional[str] = Field(default=None, max_length=100)

    @field_validator("name")
    @classmethod
    def _trim_name(cls, v: str) -> str:
        return (v or "").strip()


class RatingCreate(BaseModel):
    # Required core
    rating: int = Field(ge=1, le=5)
    difficulty: Optional[int] = Field(default=None, ge=1, le=5)
    would_take_again: Optional[bool] = None
    course_code: Optional[str] = Field(default=None, max_length=30)
    comment: Optional[str] = Field(default=None, max_length=2000)

    # 5-axis sub-metrics
    clarity: Optional[int] = Field(default=None, ge=1, le=5)
    engagement: Optional[int] = Field(default=None, ge=1, le=5)
    accessibility: Optional[int] = Field(default=None, ge=1, le=5)
    fairness: Optional[int] = Field(default=None, ge=1, le=5)
    exam_prep_quality: Optional[int] = Field(default=None, ge=1, le=5)

    # Course context
    course_title: Optional[str] = Field(default=None, max_length=200)
    semester: Optional[str] = Field(default=None, max_length=30)
    grade_received: Optional[str] = Field(default=None, max_length=5)

    # The intel
    attendance_policy: Optional[str] = Field(default=None, max_length=20)
    quiz_type: Optional[str] = Field(default=None, max_length=20)
    exam_types: Optional[list[str]] = None
    curves: Optional[str] = Field(default=None, max_length=20)

    # Class shape
    workload: Optional[str] = Field(default=None, max_length=20)
    class_format: Optional[str] = Field(default=None, max_length=20)
    class_size: Optional[str] = Field(default=None, max_length=20)

    # Structured recommendation
    recommendation: Optional[str] = Field(default=None, max_length=30)

    # Written review (preferred over the legacy `comment` field for new submissions).
    best_aspects: Optional[str] = Field(default=None, max_length=2000)
    areas_for_improvement: Optional[str] = Field(default=None, max_length=2000)
    advice: Optional[str] = Field(default=None, max_length=2000)

    _check_attendance = field_validator("attendance_policy")(_enum_validator(ATTENDANCE_VALUES))
    _check_quiz = field_validator("quiz_type")(_enum_validator(QUIZ_VALUES))
    _check_curves = field_validator("curves")(_enum_validator(CURVES_VALUES))
    _check_workload = field_validator("workload")(_enum_validator(WORKLOAD_VALUES))
    _check_format = field_validator("class_format")(_enum_validator(FORMAT_VALUES))
    _check_size = field_validator("class_size")(_enum_validator(SIZE_VALUES))
    _check_rec = field_validator("recommendation")(_enum_validator(RECOMMENDATION_VALUES))

    @field_validator("exam_types")
    @classmethod
    def _check_exam_types(cls, v):
        if v is None:
            return None
        bad = [x for x in v if x not in EXAM_TYPE_VALUES]
        if bad:
            raise ValueError(f"exam_types contains unknown values: {bad}")
        # Drop dupes while preserving order — small lists, simple.
        seen = []
        for x in v:
            if x not in seen:
                seen.append(x)
        return seen


class RatingResponse(BaseModel):
    id: int
    rating: int
    difficulty: Optional[int] = None
    would_take_again: Optional[bool] = None
    course_code: Optional[str] = None
    comment: Optional[str] = None

    # 5-axis
    clarity: Optional[int] = None
    engagement: Optional[int] = None
    accessibility: Optional[int] = None
    fairness: Optional[int] = None
    exam_prep_quality: Optional[int] = None

    # Course context
    course_title: Optional[str] = None
    semester: Optional[str] = None
    grade_received: Optional[str] = None

    # Intel
    attendance_policy: Optional[str] = None
    quiz_type: Optional[str] = None
    exam_types: Optional[list[str]] = None
    curves: Optional[str] = None

    # Shape
    workload: Optional[str] = None
    class_format: Optional[str] = None
    class_size: Optional[str] = None

    # Recommendation + written review
    recommendation: Optional[str] = None
    best_aspects: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    advice: Optional[str] = None

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
    # New: averaged sub-metrics so the list-card breakdown can render
    # without re-aggregating per row on the client.
    avg_clarity: Optional[float] = None
    avg_engagement: Optional[float] = None
    avg_accessibility: Optional[float] = None
    avg_fairness: Optional[float] = None
    avg_exam_prep_quality: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfessorDetailResponse(ProfessorResponse):
    ratings: list[RatingResponse] = []
