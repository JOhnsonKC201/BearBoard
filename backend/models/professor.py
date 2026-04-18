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
    rating = Column(Integer, nullable=False)            # 1-5
    difficulty = Column(Integer, nullable=True)         # 1-5
    would_take_again = Column(Boolean, nullable=True)
    course_code = Column(String(30), nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    professor = relationship("Professor", back_populates="ratings")
    user = relationship("User")

    # One review per (professor, user) pair — users edit by re-submitting.
    __table_args__ = (
        UniqueConstraint("professor_id", "user_id", name="uq_prof_rating_user"),
    )
