from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.services.ai_service import AIService
from app.services.affiliate import AffiliateService
from app.db.base import get_db
from app.db.models import Trip
from pydantic import BaseModel
import json

router = APIRouter()

class PlanRequest(BaseModel):
    destination: str
    days: int = 1
    origin: str = "Sài Gòn"
    mood: str = "chill"
    budget: str = "standard"
    preferences: str = ""

@router.post("/generate")
async def generate_trip_plan(request: PlanRequest, db: Session = Depends(get_db)):
    # 1. KIỂM TRA DATABASE (Bổ sung thêm mood/budget vào key nếu cần, nhưng tạm thời dùng destination/days)
    existing_trip = db.execute(
        select(Trip).where(
            Trip.destination == request.destination,
            Trip.days == request.days
        )
    ).scalars().first()

    # Để đơn giản, nếu có rồi thì lấy luôn, nhưng với AI cá nhân hóa thì nên gọi mới hoặc cache theo key phức tạp hơn.
    # Tuy nhiên để tối ưu tốc độ theo yêu cầu, ta cứ dùng cache nếu khớp destination/days.

    # 2. GỌI AI
    print(f"--- Đang gọi Duy AI tạo lịch trình {request.mood} cho: {request.destination} ---")
    itinerary = await AIService.generate_itinerary(
        destination=request.destination,
        days=request.days,
        origin=request.origin,
        mood=request.mood,
        budget=request.budget,
        preferences=request.preferences
    )
    
    if not itinerary or "error" in itinerary:
        raise HTTPException(status_code=500, detail="AI không thể phản hồi lúc này.")
    
    # 3. GẮN LINK KIẾM TIỀN
    final_plan = AffiliateService.enrich_itinerary(itinerary)
    
    # 4. LƯU VÀO DATABASE
    new_trip = Trip(
        destination=request.destination,
        days=request.days,
        preferences=request.preferences,
        itinerary_data=final_plan # SQLAlchemy sẽ tự xử lý nếu định nghĩa là JSON
    )
    db.add(new_trip)
    db.commit()
    
    return final_plan