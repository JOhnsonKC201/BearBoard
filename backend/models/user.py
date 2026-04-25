from sqlalchemy import Column, Integer, String, Text, DateTime, Date
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


# Profile photos are stored as base64 data URLs inline. MySQL's plain TEXT
# tops out at 64 KB which clips most photos; MEDIUMTEXT gives us 16 MB.
# Other dialects (SQLite/Postgres) get plain Text, which is unbounded.
AvatarURLType = Text().with_variant(MEDIUMTEXT(), "mysql")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password_hash = Column(String(255))
    name = Column(String(100))
    major = Column(String(100))
    graduation_year = Column(Integer)
    avatar_url = Column(AvatarURLType, nullable=True)
    bio = Column(Text, nullable=True)
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
