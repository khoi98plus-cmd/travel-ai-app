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
    days: int
    preferences: str = "tối ưu chi phí, trải nghiệm địa phương"

@router.post("/generate")
async def generate_trip_plan(request: PlanRequest, db: Session = Depends(get_db)):
    # 1. KIỂM TRA DATABASE
    existing_trip = db.execute(
        select(Trip).where(
            Trip.destination == request.destination,
            Trip.days == request.days
        )
    ).scalars().first()

    if existing_trip:
        print(f"--- Lấy dữ liệu từ Database cho: {request.destination} ---")
        data = existing_trip.itinerary_data
        # PHÁ GIÁP: Nếu dữ liệu là chữ, biến nó thành Object chuẩn luôn
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except:
                pass
        return data

    # 2. GỌI AI
    print(f"--- Đang gọi AI tạo lịch trình mới cho: {request.destination} ---")
    itinerary = await AIService.generate_itinerary(
        request.destination, 
        request.days, 
        request.preferences
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