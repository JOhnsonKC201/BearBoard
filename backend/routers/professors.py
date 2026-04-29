import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import Integer, func, desc, or_, cast

from core.database import get_db
from core.rate_limit import limiter
from models.professor import Professor, ProfessorRating
from models.user import User
from routers.auth import get_current_user_dep
from schemas.professor import (
    ProfessorCreate,
    ProfessorResponse,
    ProfessorDetailResponse,
    RatingCreate,
    RatingResponse,
)

router = APIRouter(prefix="/api/professors", tags=["professors"])


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def _build_aggregates(db: Session, professor_ids: list[int]) -> dict[int, dict]:
    """Compute count/avg/take-again-percent + per-axis averages in one query.
    Returning a dict keyed by professor id keeps downstream assembly simple."""
    if not professor_ids:
        return {}
    rows = (
        db.query(
            ProfessorRating.professor_id,
            func.count(ProfessorRating.id).label("cnt"),
            func.avg(ProfessorRating.rating).label("avg_rating"),
            func.avg(ProfessorRating.difficulty).label("avg_difficulty"),
            func.avg(ProfessorRating.clarity).label("avg_clarity"),
            func.avg(ProfessorRating.engagement).label("avg_engagement"),
            func.avg(ProfessorRating.accessibility).label("avg_accessibility"),
            func.avg(ProfessorRating.fairness).label("avg_fairness"),
            func.avg(ProfessorRating.exam_prep_quality).label("avg_exam_prep_quality"),
            func.sum(cast(ProfessorRating.would_take_again, Integer)).label("take_again_sum"),
            func.count(ProfessorRating.would_take_again).label("take_again_n"),
        )
        .filter(ProfessorRating.professor_id.in_(professor_ids))
        .group_by(ProfessorRating.professor_id)
        .all()
    )
    out: dict[int, dict] = {}
    for row in rows:
        take_again_pct = None
        if row.take_again_n and row.take_again_n > 0:
            take_again_pct = int(round(100 * (row.take_again_sum or 0) / row.take_again_n))
        out[row.professor_id] = {
            "rating_count": int(row.cnt or 0),
            "avg_rating": _r2(row.avg_rating),
            "avg_difficulty": _r2(row.avg_difficulty),
            "avg_clarity": _r2(row.avg_clarity),
            "avg_engagement": _r2(row.avg_engagement),
            "avg_accessibility": _r2(row.avg_accessibility),
            "avg_fairness": _r2(row.avg_fairness),
            "avg_exam_prep_quality": _r2(row.avg_exam_prep_quality),
            "would_take_again_pct": take_again_pct,
        }
    return out


def _r2(x):
    return float(round(x, 2)) if x is not None else None


def _attach_aggregates(professors: list[Professor], aggs: dict[int, dict]) -> list[dict]:
    out = []
    for p in professors:
        agg = aggs.get(p.id, {})
        out.append({
            "id": p.id,
            "name": p.name,
            "department": p.department,
            "rating_count": agg.get("rating_count", 0),
            "avg_rating": agg.get("avg_rating"),
            "avg_difficulty": agg.get("avg_difficulty"),
            "avg_clarity": agg.get("avg_clarity"),
            "avg_engagement": agg.get("avg_engagement"),
            "avg_accessibility": agg.get("avg_accessibility"),
            "avg_fairness": agg.get("avg_fairness"),
            "avg_exam_prep_quality": agg.get("avg_exam_prep_quality"),
            "would_take_again_pct": agg.get("would_take_again_pct"),
            "created_at": p.created_at,
        })
    return out


# ---------------------------------------------------------------------------
# Rating <-> response serialization (extracted because two routes use it)
# ---------------------------------------------------------------------------

def _parse_exam_types(raw):
    if not raw:
        return None
    if isinstance(raw, list):
        return raw
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else None
    except Exception:
        return None


def _serialize_rating(r: ProfessorRating, user: User | None = None) -> dict:
    author = user or r.user
    return {
        "id": r.id,
        "rating": r.rating,
        "difficulty": r.difficulty,
        "would_take_again": r.would_take_again,
        "course_code": r.course_code,
        "comment": r.comment,
        "clarity": r.clarity,
        "engagement": r.engagement,
        "accessibility": r.accessibility,
        "fairness": r.fairness,
        "exam_prep_quality": r.exam_prep_quality,
        "course_title": r.course_title,
        "semester": r.semester,
        "grade_received": r.grade_received,
        "attendance_policy": r.attendance_policy,
        "quiz_type": r.quiz_type,
        "exam_types": _parse_exam_types(r.exam_types),
        "curves": r.curves,
        "workload": r.workload,
        "class_format": r.class_format,
        "class_size": r.class_size,
        "recommendation": r.recommendation,
        "best_aspects": r.best_aspects,
        "areas_for_improvement": r.areas_for_improvement,
        "advice": r.advice,
        "user_id": r.user_id,
        "author": {
            "id": author.id,
            "name": author.name,
            "major": author.major,
            "role": getattr(author, "role", "student") or "student",
        } if author else None,
        "created_at": r.created_at,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ProfessorResponse])
def list_professors(
    q: str | None = Query(default=None, max_length=100),
    sort: str = Query("top", regex="^(top|new|controversial)$"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Professor)
    if q:
        needle = f"%{q.strip().lower()}%"
        profs_via_course = (
            db.query(ProfessorRating.professor_id)
            .filter(func.lower(ProfessorRating.course_code).like(needle))
            .distinct()
        )
        query = query.filter(
            or_(
                func.lower(Professor.name).like(needle),
                func.lower(Professor.department).like(needle),
                Professor.id.in_(profs_via_course),
            )
        )

    if sort == "new":
        professors = query.order_by(desc(Professor.created_at)).limit(limit).all()
        aggs = _build_aggregates(db, [p.id for p in professors])
        return _attach_aggregates(professors, aggs)

    candidates = query.limit(limit * 3).all()
    aggs = _build_aggregates(db, [p.id for p in candidates])
    enriched = _attach_aggregates(candidates, aggs)
    if sort == "top":
        enriched.sort(
            key=lambda p: (
                p["rating_count"] > 0,
                p["avg_rating"] or 0,
                p["rating_count"],
            ),
            reverse=True,
        )
    else:  # controversial
        enriched.sort(
            key=lambda p: (p["rating_count"], -abs((p["avg_rating"] or 3) - 3)),
            reverse=True,
        )
    return enriched[:limit]


@router.post("", response_model=ProfessorResponse)
@limiter.limit("10/minute")
def create_professor(
    request: Request,
    data: ProfessorCreate,
    user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    name = data.name.strip()
    existing = (
        db.query(Professor).filter(func.lower(Professor.name) == name.lower()).first()
    )
    if existing:
        return _attach_aggregates([existing], _build_aggregates(db, [existing.id]))[0]

    prof = Professor(
        name=name,
        department=(data.department or "").strip() or None,
        created_by=user.id,
    )
    db.add(prof)
    db.commit()
    db.refresh(prof)
    return _attach_aggregates([prof], {})[0]


@router.get("/{prof_id}", response_model=ProfessorDetailResponse)
def get_professor(prof_id: int, db: Session = Depends(get_db)):
    prof = db.query(Professor).filter(Professor.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professor not found")

    ratings = (
        db.query(ProfessorRating)
        .options(joinedload(ProfessorRating.user))
        .filter(ProfessorRating.professor_id == prof_id)
        .order_by(desc(ProfessorRating.created_at))
        .all()
    )

    aggs = _build_aggregates(db, [prof.id]).get(prof.id, {})
    return {
        "id": prof.id,
        "name": prof.name,
        "department": prof.department,
        "rating_count": aggs.get("rating_count", 0),
        "avg_rating": aggs.get("avg_rating"),
        "avg_difficulty": aggs.get("avg_difficulty"),
        "avg_clarity": aggs.get("avg_clarity"),
        "avg_engagement": aggs.get("avg_engagement"),
        "avg_accessibility": aggs.get("avg_accessibility"),
        "avg_fairness": aggs.get("avg_fairness"),
        "avg_exam_prep_quality": aggs.get("avg_exam_prep_quality"),
        "would_take_again_pct": aggs.get("would_take_again_pct"),
        "created_at": prof.created_at,
        "ratings": [_serialize_rating(r) for r in ratings],
    }


@router.post("/{prof_id}/ratings", response_model=RatingResponse)
@limiter.limit("5/minute")
def create_or_update_rating(
    request: Request,
    prof_id: int,
    data: RatingCreate,
    user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    prof = db.query(Professor).filter(Professor.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professor not found")

    existing = (
        db.query(ProfessorRating)
        .filter(
            ProfessorRating.professor_id == prof_id,
            ProfessorRating.user_id == user.id,
        )
        .first()
    )

    # Common field set so the create + update branches can't drift.
    payload = {
        "rating": data.rating,
        "difficulty": data.difficulty,
        "would_take_again": data.would_take_again,
        "course_code": (data.course_code or "").strip() or None,
        "comment": (data.comment or "").strip() or None,
        "clarity": data.clarity,
        "engagement": data.engagement,
        "accessibility": data.accessibility,
        "fairness": data.fairness,
        "exam_prep_quality": data.exam_prep_quality,
        "course_title": (data.course_title or "").strip() or None,
        "semester": (data.semester or "").strip() or None,
        "grade_received": (data.grade_received or "").strip() or None,
        "attendance_policy": data.attendance_policy or None,
        "quiz_type": data.quiz_type or None,
        "exam_types": json.dumps(data.exam_types) if data.exam_types else None,
        "curves": data.curves or None,
        "workload": data.workload or None,
        "class_format": data.class_format or None,
        "class_size": data.class_size or None,
        "recommendation": data.recommendation or None,
        "best_aspects": (data.best_aspects or "").strip() or None,
        "areas_for_improvement": (data.areas_for_improvement or "").strip() or None,
        "advice": (data.advice or "").strip() or None,
    }

    if existing:
        for k, v in payload.items():
            setattr(existing, k, v)
        rating_obj = existing
    else:
        rating_obj = ProfessorRating(professor_id=prof_id, user_id=user.id, **payload)
        db.add(rating_obj)

    db.commit()
    db.refresh(rating_obj)
    return _serialize_rating(rating_obj, user=user)


@router.delete("/{prof_id}/ratings/mine", status_code=204)
def delete_my_rating(
    prof_id: int,
    user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    rating = (
        db.query(ProfessorRating)
        .filter(
            ProfessorRating.professor_id == prof_id,
            ProfessorRating.user_id == user.id,
        )
        .first()
    )
    if not rating:
        raise HTTPException(status_code=404, detail="No rating to delete")
    db.delete(rating)
    db.commit()
    return None
