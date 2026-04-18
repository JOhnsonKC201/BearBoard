from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200))
    body = Column(Text)
    category = Column(String(50))
    author_id = Column(Integer, ForeignKey("users.id"))
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    event_date = Column(Date, nullable=True)
    event_time = Column(String(20), nullable=True)
    # SOS posts float to the top of the feed and trigger immediate notifications
    # to users who share the author's major. Auto-resolved when a comment lands.
    is_sos = Column(Boolean, nullable=False, default=False)
    sos_resolved = Column(Boolean, nullable=False, default=False)
    # Used by housing/swap posts. price is a free-form string ("$25", "Free",
    # "OBO") rather than a number so we don't lose nuance.
    price = Column(String(40), nullable=True)
    contact_info = Column(String(200), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    author = relationship("User", back_populates="posts")
    votes = relationship("Vote", back_populates="post")
    comments = relationship("Comment", back_populates="post")
