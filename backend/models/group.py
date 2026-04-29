from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    course_code = Column(String(20))
    description = Column(Text)
    member_count = Column(Integer, default=1)
    created_by = Column(Integer, ForeignKey("users.id"))
    # Privacy + join-flow toggles. is_private hides the group from the public
    # browse list and forces invitation-only joining. requires_approval lets
    # a public group still gate joins behind admin review. posting_permission
    # is reserved for when posts gain a group_id (today the API surfaces it
    # but no post path consumes it yet).
    is_private = Column(Boolean, nullable=False, default=False, server_default="0")
    requires_approval = Column(Boolean, nullable=False, default=False, server_default="0")
    posting_permission = Column(String(20), nullable=False, default="all", server_default="all")
    avatar_url = Column(String(500), nullable=True)
    cover_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    creator = relationship("User")
