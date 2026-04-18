from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    major: Optional[str] = None
    graduation_year: Optional[int] = None

class UserResponse(BaseModel):
    """Self-view of the authenticated user (includes email/PII)."""
    id: int
    email: str
    name: str
    major: Optional[str] = None
    graduation_year: Optional[int] = None
    avatar_url: Optional[str] = None
    karma: int
    streak_count: int = 0
    role: str = "student"

    class Config:
        from_attributes = True


class UserPublicResponse(BaseModel):
    """Public view of a user. Drops email so /api/users/{id} cannot be used
    to scrape every registered .edu address."""
    id: int
    name: str
    major: Optional[str] = None
    graduation_year: Optional[int] = None
    avatar_url: Optional[str] = None
    karma: int
    streak_count: int = 0
    role: str = "student"

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str
    password: str
