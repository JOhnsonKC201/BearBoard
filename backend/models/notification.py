from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True)
    kind = Column(String(40), nullable=False)
    read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("recipient_id", "post_id", "kind", name="uq_notif_recipient_post_kind"),
        Index("ix_notif_recipient_read", "recipient_id", "read"),
    )

    recipient = relationship("User")
    post = relationship("Post")
