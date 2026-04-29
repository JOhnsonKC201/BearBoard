from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class GroupJoinRequest(Base):
    """Request from a user to join a private (or approval-required public)
    group. Admins approve or deny.

    Status transitions:
        pending  -> approved  (admin approves; a row is added to group_members)
                 -> denied    (admin denies; row stays for audit; user can re-request later)
    """
    __tablename__ = "group_join_requests"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_join_request_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    created_at = Column(DateTime, server_default=func.now())

    group = relationship("Group")
    user = relationship("User")
