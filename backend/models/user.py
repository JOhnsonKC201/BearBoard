from sqlalchemy import Column, Integer, String, DateTime
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
    created_at = Column(DateTime, server_default=func.now())
    # TODO: updated_at column is missing — needs to be added
