from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class GroupInvitation(Base):
    """Pending invitation from a group admin to a user.

    Status transitions:
        pending  -> accepted   (user accepts; a row is added to group_members)
                 -> declined   (user declines; row stays for audit/visibility)
                 -> revoked    (admin cancels before user responds)

    Acceptance does NOT delete the invitation row — it stays as a record.
    The (group_id, invited_user_id) unique constraint means at most one
    invitation per pair exists; new invites after a decline/revoke
    overwrite the prior status (handled in the route, not the schema).
    """
    __tablename__ = "group_invitations"
    __table_args__ = (
        UniqueConstraint("group_id", "invited_user_id", name="uq_group_invite_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    created_at = Column(DateTime, server_default=func.now())

    group = relationship("Group")
    invited_user = relationship("User", foreign_keys=[invited_user_id])
    inviter = relationship("User", foreign_keys=[invited_by])
