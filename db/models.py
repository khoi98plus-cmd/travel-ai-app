from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from .base import Base

class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    destination = Column(String, index=True)
    days = Column(Integer)
    preferences = Column(String)
    itinerary_data = Column(JSON) # Lưu toàn bộ JSON từ AI
    created_at = Column(DateTime(timezone=True), server_default=func.now())
