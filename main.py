from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="Travel AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TravelRequest(BaseModel):
    query: str

class ItineraryRequest(BaseModel):
    query: str
    days: int

def extract_json(text):
    try:
        # Tìm nội dung trong cặp ngoặc nhọn đầu tiên và cuối cùng
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return json.loads(text)
    except:
        return None

@app.post("/generate-trip")
async def generate_trip(request: TravelRequest):
    try:
        prompt = (
            f"Thông tin du lịch về '{request.query}'. "
            f"Trả về DUY NHẤT 1 đối tượng JSON: "
            f"{{\"place\": \"tên\", \"desc\": \"mô tả ngắn gọn\", \"cafe\": \"tên quán cafe\", \"img_tag\": \"từ khóa tiếng Anh để tìm ảnh\"}}"
        )
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        
        content = response.choices[0].message.content
        result = extract_json(content)
        
        if result: return result
        raise ValueError("JSON format error")

    except Exception as e:
        # Trả về dữ liệu mặc định nếu AI lỗi, tránh làm sập Frontend
        return {
            "place": request.query,
            "desc": "Một địa danh tuyệt vời đang chờ bạn khám phá cùng TravelVN.",
            "cafe": "Quán cafe địa phương view cực chill",
            "img_tag": "vietnam,travel"
        }

@app.post("/generate-full-itinerary")
async def generate_full_itinerary(request: ItineraryRequest):
    try:
        prompt = (
            f"Lịch trình {request.days} ngày tại {request.query}. Phong cách hài hước. "
            f"Trả về JSON: {{\"itinerary\": [ {{\"day\": 1, \"theme\": \"...\", \"slots\": [ {{\"time\": \"...\", \"activity\": \"...\", \"note\": \"...\", \"joke\": \"...\"}} ] }} ] }}"
        )
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8
        )
        
        result = extract_json(response.choices[0].message.content)
        if result: return result
        return {"error": "Không thể tạo lịch trình"}
    except:
        return {"error": "Lỗi kết nối AI"}

@app.get("/")
async def root():
    return {"status": "Online"}
