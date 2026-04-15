from pydantic import BaseModel
from typing import Optional


class PostCreate(BaseModel):
    title: str
    body: str
    category: str  # TODO: should this be an enum?


class PostResponse(BaseModel):
    id: int
    title: str
    body: str
    category: str
    author_id: int
    upvotes: int
    downvotes: int

    class Config:
        from_attributes = True
