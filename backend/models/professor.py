from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey, DateTime, Boolean, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Professor(Base):
    __tablename__ = "professors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    department = Column(String(100), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    creator = relationship("User")
    ratings = relationship(
        "ProfessorRating",
        back_populates="professor",
        cascade="all, delete-orphan",
    )


class ProfessorRating(Base):
    __tablename__ = "professor_ratings"

    id = Column(Integer, primary_key=True, index=True)
    # CASCADE delete so removing a professor drops their reviews too.
    professor_id = Column(
        Integer,
        ForeignKey("professors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Overall (1-5) — kept as the headline score so legacy reviews still work.
    # New reviews will typically derive this from the 5-axis breakdown below
    # but the field stays canonical so the existing aggregations + UI keep
    # functioning without conditionals everywhere.
    rating = Column(Integer, nullable=False)
    difficulty = Column(Integer, nullable=True)
    would_take_again = Column(Boolean, nullable=True)
    course_code = Column(String(30), nullable=True)
    # Legacy single-textarea comment. Kept readable on old reviews; new
    # reviews use best_aspects + areas_for_improvement + advice instead.
    comment = Column(Text, nullable=True)

    # 5-axis sub-metrics (1-5 each, all nullable). Surface as "Clarity",
    # "Engagement", "Accessibility", "Fairness", "Exam prep" on the UI.
    clarity = Column(Integer, nullable=True)
    engagement = Column(Integer, nullable=True)
    accessibility = Column(Integer, nullable=True)
    fairness = Column(Integer, nullable=True)
    exam_prep_quality = Column(Integer, nullable=True)

    # Course context — what class was this rating for.
    course_title = Column(String(200), nullable=True)
    semester = Column(String(30), nullable=True)
    grade_received = Column(String(5), nullable=True)

    # "The intel" — practical stuff students need before they pick a section.
    attendance_policy = Column(String(20), nullable=True)  # required | not_required | recommended
    quiz_type = Column(String(20), nullable=True)          # none | scheduled | pop | both
    exam_types = Column(Text, nullable=True)               # JSON list of strings
    curves = Column(String(20), nullable=True)             # never | as_needed | always

    # Class shape.
    workload = Column(String(20), nullable=True)           # light | moderate | heavy
    class_format = Column(String(20), nullable=True)       # in_person | hybrid | online
    class_size = Column(String(20), nullable=True)         # small | medium | large

    # Structured 4-tier recommendation (would_take_again above stays the
    # boolean version used by the take-again-percent aggregator).
    recommendation = Column(String(30), nullable=True)     # absolutely_yes | yes | only_if_no_choice | never

    # Three focused written-review prompts (better signal than one
    # open-ended "comments" textarea).
    best_aspects = Column(Text, nullable=True)
    areas_for_improvement = Column(Text, nullable=True)
    advice = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    professor = relationship("Professor", back_populates="ratings")
    user = relationship("User")

    # One review per (professor, user) pair — users edit by re-submitting.
    __table_args__ = (
        UniqueConstraint("professor_id", "user_id", name="uq_prof_rating_user"),
    )
