from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    body = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    # Self-referential FK enabling Facebook-style threaded replies. Capped at
    # depth 1 in the API (replies attach to top-level comments only) so the
    # UI never needs to render arbitrarily nested walls. Nullable for
    # top-level comments.
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    # Denormalized vote counts. Updated by the vote route on every up/down
    # toggle so the feed and detail page can sort + render scores without
    # joining the comment_votes table on every read. Mirrors the same
    # pattern Post uses for its upvotes/downvotes columns.
    upvotes = Column(Integer, nullable=False, default=0, server_default="0")
    downvotes = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, server_default=func.now())

    author = relationship("User", back_populates="comments")
    post = relationship("Post", back_populates="comments")
    parent = relationship("Comment", remote_side=[id], back_populates="replies")
    replies = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    votes = relationship(
        "CommentVote",
        back_populates="comment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
