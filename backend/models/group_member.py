from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class GroupMember(Base):
    """Join table between users and study groups.

    Roles
    -----
    'owner'  — exactly one per group (the creator). Can transfer ownership and delete.
    'admin'  — co-administrator. Can invite, remove, promote/demote within the group
               but cannot transfer or delete.
    'member' — default. Can view and post (subject to Group.posting_permission).

    Status
    ------
    'active' — normal membership.
    'banned' — kept (not deleted) so a re-join attempt can be detected and
               rejected without leaking that the user was specifically banned.

    Pending invites live in `group_invitations` (separate table), not as a
    membership row, so the unique constraint on (group_id, user_id) here is
    a strict invariant: a user is either an active member, banned, or
    has no row at all.
    """
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="member", server_default="member")
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")
    muted = Column(Boolean, nullable=False, default=False, server_default="0")
    joined_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    inviter = relationship("User", foreign_keys=[invited_by])
    group = relationship("Group", backref="members")
