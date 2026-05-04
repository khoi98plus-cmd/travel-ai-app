from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import json
import os
from dotenv import load_dotenv

# 1. NẠP BIẾN MÔI TRƯỜNG (Để bảo mật API Key khi lên Render)
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="Travel AI API")

# 2. CẤU HÌNH CORS (Bắt buộc để Frontend gọi được Backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. ĐỊNH NGHĨA MODEL DỮ LIỆU (Data Schema)
class TravelRequest(BaseModel):
    query: str

class ItineraryRequest(BaseModel):
    query: str
    days: int

# 4. ENDPOINT: TẠO THÔNG TIN TỔNG QUAN (ẢNH & MÔ TẢ)
@app.post("/generate-trip")
async def generate_trip(request: TravelRequest):
    print(f"--- Đang phân tích địa danh: {request.query} ---")
    try:
        prompt = (
            f"Hãy đóng vai chuyên gia du lịch. Cung cấp thông tin về '{request.query}'. "
            f"Trả về DUY NHẤT định dạng JSON sau (không ghi chữ thừa): "
            f"{{ 'place': 'tên địa danh tiếng Việt', 'place_en': 'tên tiếng Anh để tìm ảnh', "
            f"'desc': 'mô tả ngắn gọn hấp dẫn', 'cafe': 'tên một quán cafe thực tế tại đó' }}"
        )
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        
        # Chuyển chuỗi JSON từ AI thành Object Python
        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"Lỗi AI: {str(e)}")
        # Trả về dữ liệu dự phòng nếu AI gặp sự cố
        return {
            "place": request.query, 
            "place_en": request.query, 
            "desc": "Một địa danh tuyệt đẹp đang chờ bạn khám phá.", 
            "cafe": "Quán cafe địa phương view đẹp"
        }

# 5. ENDPOINT: TẠO LỊCH TRÌNH CHI TIẾT (LÊN KẾ HOẠCH THEO NGÀY)
@app.post("/generate-full-itinerary")
async def generate_full_itinerary(request: ItineraryRequest):
    print(f"--- Đang lên lịch trình {request.days} ngày cho: {request.query} ---")
    try:
        prompt = (
            f"Lên lịch trình du lịch {request.days} ngày tại {request.query}. "
            f"Phong cách viết: Hài hước, mặn mà, có lời khuyên thực tế. "
            f"Trả về JSON định dạng: {{ 'itinerary': [ {{ 'day': 1, 'theme': 'Chủ đề ngày', "
            f"'slots': [ {{ 'time': '08:00', 'activity': 'Tên hoạt động', 'note': 'Mô tả', 'joke': 'Lời khuyên vui' }} ], "
            f"'daily_advice': 'Lời khuyên sống còn' }} ] }}"
        )
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8
        )
        
        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"Lỗi lịch trình: {str(e)}")
        return {"error": "Không thể tạo lịch trình ngay lúc này. Sếp thử lại nhé!"}

# 6. KIỂM TRA TRẠNG THÁI (Để Render biết server vẫn sống)
@app.get("/")
async def root():
    return {"status": "Server đang chạy cực mượt sếp ơi!"}
