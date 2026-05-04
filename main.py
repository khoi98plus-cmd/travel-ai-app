from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import json
import os
import re
from dotenv import load_dotenv

# 1. NẠP BIẾN MÔI TRƯỜNG
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="Travel AI API")

# 2. CẤU HÌNH CORS (Để Frontend gọi được Backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. ĐỊNH NGHĨA MODEL DỮ LIỆU
class TravelRequest(BaseModel):
    query: str

class ItineraryRequest(BaseModel):
    query: str
    days: int

# HÀM BỔ TRỢ: Tách JSON từ văn bản của AI (Phòng trường hợp AI nói nhảm)
def extract_json(text):
    try:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return json.loads(text)
    except:
        return None

# 4. ENDPOINT: TẠO THÔNG TIN TỔNG QUAN
@app.post("/generate-trip")
async def generate_trip(request: TravelRequest):
    print(f"--- Đang phân tích địa danh: {request.query} ---")
    try:
        prompt = (
            f"Cung cấp thông tin du lịch về '{request.query}'. "
            f"Trả về DUY NHẤT 1 đối tượng JSON: "
            f"{{ 'place': 'tên Việt', 'place_en': 'tên Anh', 'desc': 'mô tả', 'cafe': 'tên quán' }}"
        )
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        
        content = response.choices[0].message.content
        result = extract_json(content)
        
        if result:
            return result
        raise ValueError("AI trả về JSON không đúng định dạng")

    except Exception as e:
        print(f"Lỗi AI: {str(e)}")
        # Trả về dữ liệu dự phòng "Cứu bồ" - Đảm bảo Frontend luôn có cái để hiện
        return {
            "place": request.query, 
            "place_en": request.query, 
            "desc": "Một địa danh tuyệt đẹp đang chờ bạn khám phá cùng người thân và bạn bè.", 
            "cafe": "Quán cafe địa phương view đẹp"
        }

# 5. ENDPOINT: TẠO LỊCH TRÌNH CHI TIẾT
@app.post("/generate-full-itinerary")
async def generate_full_itinerary(request: ItineraryRequest):
    print(f"--- Lên lịch trình {request.days} ngày cho: {request.query} ---")
    try:
        prompt = (
            f"Lên lịch trình {request.days} ngày tại {request.query}. "
            f"Phong cách: Hài hước, mặn mà. Trả về JSON: "
            f"{{ 'itinerary': [ {{ 'day': 1, 'theme': '...', 'slots': [ {{ 'time': '...', 'activity': '...', 'note': '...', 'joke': '...' }} ], 'daily_advice': '...' }} ] }}"
        )
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8
        )
        
        content = response.choices[0].message.content
        result = extract_json(content)
        
        if result:
            return result
        raise ValueError("Lỗi JSON lịch trình")

    except Exception as e:
        print(f"Lỗi lịch trình: {str(e)}")
        return {"error": "Lên lịch trình kẹt rồi sếp ơi, thử lại nhé!"}

# 6. KIỂM TRA TRẠNG THÁI
@app.get("/")
async def root():
    return {"status": "Server đang chạy cực mượt sếp ơi!"}
