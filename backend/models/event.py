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
    # External-source bookkeeping. external_id is the iCal UID (or other stable
    # remote id) we dedupe on when re-syncing from morgan.edu.
    source = Column(String(40), nullable=True)
    external_id = Column(String(255), nullable=True, index=True)
    source_url = Column(String(500), nullable=True)

    creator = relationship("User")
