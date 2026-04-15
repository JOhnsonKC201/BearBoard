from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    event_date = Column(Date, nullable=False)
    start_time = Column(String(20))
    end_time = Column(String(20))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())

    creator = relationship("User")
