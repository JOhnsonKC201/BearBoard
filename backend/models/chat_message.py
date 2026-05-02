from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class ChatMessage(Base):
    """A 1:1 direct message between two users.

    Conversations are implicit: the unordered pair {sender_id, recipient_id}
    defines a thread. We do not store a separate `chat_conversations` row;
    the conversation list is derived from a group-by over messages.
    """

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    # NULL until the recipient acks via a `read` WS event or POST .../read.
    read_at = Column(DateTime, nullable=True)

    __table_args__ = (
        # History pulls (`messages between A and B, ordered by created_at`)
        # hit this index; the (recipient_id, sender_id) variant covers the
        # mirrored direction without a second composite.
        Index("ix_chat_msg_pair_created", "sender_id", "recipient_id", "created_at"),
        Index("ix_chat_msg_recipient_unread", "recipient_id", "read_at"),
    )

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
