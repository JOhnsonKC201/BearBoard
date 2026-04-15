from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
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
    created_at = Column(DateTime, server_default=func.now())
    # TODO: updated_at is missing
    # TODO: relationship to User model is not defined
