from sqlalchemy import Column, Integer, String, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password_hash = Column(String(255))
    name = Column(String(100))
    major = Column(String(100))
    graduation_year = Column(Integer)
    avatar_url = Column(String(500), default="")
    karma = Column(Integer, default=0)
    streak_count = Column(Integer, default=0, nullable=False)
    last_activity_date = Column(Date, nullable=True)
    # One of: student (default), developer (badge only), moderator, admin.
    # Validated by the ROLES tuple below rather than a DB-level enum so we can
    # add roles later without a migration per dialect.
    role = Column(String(20), nullable=False, default="student", server_default="student")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    posts = relationship("Post", back_populates="author")
    votes = relationship("Vote", back_populates="user")
    comments = relationship("Comment", back_populates="author")


ROLES = ("student", "developer", "moderator", "admin")
