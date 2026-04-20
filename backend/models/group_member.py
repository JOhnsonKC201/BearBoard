from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class GroupMember(Base):
    """Join table between users and study groups.

    member_count on Group is kept as a cached count maintained by the
    endpoints that insert/delete rows here; the source of truth is this
    table. A composite unique constraint on (group_id, user_id) prevents
    the same user from joining a group twice.
    """
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    joined_at = Column(DateTime, server_default=func.now())

    user = relationship("User")
    group = relationship("Group", backref="members")
