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
    """Lấy JSON hợp lệ từ phản hồi LLM (bỏ markdown ```, khớp ngoặc {})."""
    if not text or not isinstance(text, str):
        return None
    s = text.strip()
    # Bỏ khối ```json ... ```
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```\s*$", "", s)
        s = s.strip()
    start = s.find("{")
    if start == -1:
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            return None
    depth = 0
    for i in range(start, len(s)):
        c = s[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                chunk = s[start : i + 1]
                try:
                    return json.loads(chunk)
                except json.JSONDecodeError:
                    return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
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
        
        if result:
            return result
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
        if result and isinstance(result.get("itinerary"), list):
            return result
        return {"error": "Không thể tạo lịch trình", "itinerary": []}
    except Exception:
        return {"error": "Lỗi kết nối AI", "itinerary": []}

@app.get("/")
async def root():
    return {"status": "Online"}
