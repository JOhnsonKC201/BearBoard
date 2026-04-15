from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    major: Optional[str] = None
    graduation_year: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    major: Optional[str] = None
    graduation_year: Optional[int] = None
    avatar_url: Optional[str] = None
    karma: int

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str
    password: str
