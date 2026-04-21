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


def _build_aggregates(db: Session, professor_ids: list[int]) -> dict[int, dict]:
    """Compute count/avg/take-again-percent per professor in one query each.

    Returning a dict keyed by professor id keeps the downstream assembly simple
    without forcing us to round-trip N+1 queries.
    """
    if not professor_ids:
        return {}
    rows = (
        db.query(
            ProfessorRating.professor_id,
            func.count(ProfessorRating.id).label("cnt"),
            func.avg(ProfessorRating.rating).label("avg_rating"),
            func.avg(ProfessorRating.difficulty).label("avg_difficulty"),
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
            "avg_rating": float(round(row.avg_rating, 2)) if row.avg_rating is not None else None,
            "avg_difficulty": float(round(row.avg_difficulty, 2)) if row.avg_difficulty is not None else None,
            "would_take_again_pct": take_again_pct,
        }
    return out


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
            "would_take_again_pct": agg.get("would_take_again_pct"),
            "created_at": p.created_at,
        })
    return out


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
        query = query.filter(
            or_(func.lower(Professor.name).like(needle), func.lower(Professor.department).like(needle))
        )

    # For "top" we need aggregates to rank, so fetch candidates then sort in
    # Python after attaching aggregates. For "new" the DB can sort directly.
    if sort == "new":
        professors = query.order_by(desc(Professor.created_at)).limit(limit).all()
        aggs = _build_aggregates(db, [p.id for p in professors])
        return _attach_aggregates(professors, aggs)

    # top / controversial: pull a larger candidate set then sort by aggregates
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
    else:  # controversial — mid-tier avg but high volume
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
    # Case-insensitive dedupe: a school has one "Dr. Smith", not two.
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
    base = {
        "id": prof.id,
        "name": prof.name,
        "department": prof.department,
        "rating_count": aggs.get("rating_count", 0),
        "avg_rating": aggs.get("avg_rating"),
        "avg_difficulty": aggs.get("avg_difficulty"),
        "would_take_again_pct": aggs.get("would_take_again_pct"),
        "created_at": prof.created_at,
        "ratings": [
            {
                "id": r.id,
                "rating": r.rating,
                "difficulty": r.difficulty,
                "would_take_again": r.would_take_again,
                "course_code": r.course_code,
                "comment": r.comment,
                "user_id": r.user_id,
                "author": {
                    "id": r.user.id,
                    "name": r.user.name,
                    "major": r.user.major,
                    "role": getattr(r.user, "role", "student") or "student",
                } if r.user else None,
                "created_at": r.created_at,
            }
            for r in ratings
        ],
    }
    return base


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
    if existing:
        # Editing a past rating — users change their mind, no need to force
        # delete-then-recreate.
        existing.rating = data.rating
        existing.difficulty = data.difficulty
        existing.would_take_again = data.would_take_again
        existing.course_code = (data.course_code or "").strip() or None
        existing.comment = (data.comment or "").strip() or None
        db.commit()
        db.refresh(existing)
        rating_obj = existing
    else:
        rating_obj = ProfessorRating(
            professor_id=prof_id,
            user_id=user.id,
            rating=data.rating,
            difficulty=data.difficulty,
            would_take_again=data.would_take_again,
            course_code=(data.course_code or "").strip() or None,
            comment=(data.comment or "").strip() or None,
        )
        db.add(rating_obj)
        db.commit()
        db.refresh(rating_obj)

    return {
        "id": rating_obj.id,
        "rating": rating_obj.rating,
        "difficulty": rating_obj.difficulty,
        "would_take_again": rating_obj.would_take_again,
        "course_code": rating_obj.course_code,
        "comment": rating_obj.comment,
        "user_id": rating_obj.user_id,
        "author": {
            "id": user.id,
            "name": user.name,
            "major": user.major,
            "role": getattr(user, "role", "student") or "student",
        },
        "created_at": rating_obj.created_at,
    }


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
