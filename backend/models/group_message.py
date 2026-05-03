from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class GroupMessage(Base):
    """A message posted in a group chat.

    Mirrors the shape of `chat_messages` (1-on-1 DMs) so the frontend can
    reuse most of its rendering. The big difference: `group_id` instead of
    `recipient_id`, and access checks happen via `group_members` rather
    than a 2-party check. The author's identity is `author_id`; we keep
    the field NOT NULL so historical attribution is never lost — anonymity
    is enforced at the API serialization layer (matches the same
    contract used for posts/comments).
    """

    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    # NULL unless the author has edited the message via the WS edit frame
    # or PATCH endpoint. Same 15-min window contract as 1-on-1 chat.
    edited_at = Column(DateTime, nullable=True)

    __table_args__ = (
        # Pulling history for a given group is the dominant query
        # ("messages in group X, ordered by created_at desc, paginated").
        Index("ix_group_msg_group_created", "group_id", "created_at"),
    )

    group = relationship("Group")
    author = relationship("User")
