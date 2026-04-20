from pydantic import BaseModel, Field
from typing import Optional

class UserCreate(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(max_length=100)
    major: Optional[str] = Field(default=None, max_length=100)
    graduation_year: Optional[int] = Field(default=None, ge=1900, le=2100)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    major: Optional[str] = Field(default=None, max_length=100)
    graduation_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    bio: Optional[str] = Field(default=None, max_length=500)

class UserResponse(BaseModel):
    """Self-view of the authenticated user (includes email/PII)."""
    id: int
    email: str
    name: str
    major: Optional[str] = None
    graduation_year: Optional[int] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
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
    bio: Optional[str] = None
    karma: int
    streak_count: int = 0
    role: str = "student"

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str
    password: str
