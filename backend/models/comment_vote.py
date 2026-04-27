from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class CommentVote(Base):
    """Per-user vote on a comment. Mirrors the Vote model used for posts so
    the toggle/change/new logic stays uniform across the codebase. Capped
    at one row per (user, comment) by the unique constraint."""

    __tablename__ = "comment_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    vote_type = Column(String(10), nullable=False)  # "up" or "down"
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "comment_id", name="uq_user_comment_vote"),)

    user = relationship("User")
    comment = relationship("Comment", back_populates="votes")
