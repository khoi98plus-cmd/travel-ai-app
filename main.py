from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="DUY GO API")

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


def _default_trip(query: str):
    return {
        "place": query,
        "place_en": query,
        "desc": "Duy nhắc bạn: điểm đến cực chill — Cùng Duy Vi Vu thôi!",
        "cafe": "Quán cafe view xịn — Duy Thủ Thỉ chọn giùm team nhé!",
        "img_tag": "vietnam,travel",
        "photo_spots": [
            {"name": "Góc hoàng hôn view thành phố", "tip": "Đứng cao một chút, chụp ngược sáng nhẹ cho mood film.", "maps_query": query},
            {"name": "Phố cổ / chợ địa phương", "tip": "Duy thủ thỉ: chụp cận đồ ăn + người dân đang cười.", "maps_query": f"{query} old town"},
            {"name": "Bờ biển hoặc công viên gần đó", "tip": "Góc thấp + cát/wave là auto triệu like.", "maps_query": f"{query} beach park"},
        ],
        "packing_hints": [
            "Giày đi bộ êm chân",
            "Nón/mũ + kem chống nắng",
            "Sạc dự phòng & ổ cắm nếu cần",
        ],
        "safety_tips": [
            "Giữ túi zip trước người ở chợ đông.",
            "Book xe chính chủ hoặc app uy tín.",
            "Uống nước đóng chai, tránh đá vỉa hè nếu bụng nhạy cảm.",
        ],
    }


@app.post("/generate-trip")
async def generate_trip(request: TravelRequest):
    try:
        prompt = (
            f"Thông tin du lịch về '{request.query}' cho app DUY GO (Duy nhắc bạn, Cùng Duy Vi Vu). "
            "Trả về DUY NHẤT 1 JSON (không markdown): "
            '{"place":"tên địa danh","place_en":"tên tiếng Anh/ngắn cho tìm vé","desc":"mô tả ngắn thân thiện",'
            '"cafe":"gợi ý quán cafe/snack",'
            '"img_tag":"từ khóa tiếng Anh,comma,separated cho ảnh",'
            '"photo_spots":[{"name":"...","tip":"góc chụp/lưu ý","maps_query":"chuỗi tìm Google Maps"}],'
            '"packing_hints":["3-6 món đồ nên mang theo"],'
            '"safety_tips":["2-4 cảnh báo an ninh/an toàn ngắn"]}'
        )

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        content = response.choices[0].message.content
        result = extract_json(content)

        if result:
            if not isinstance(result.get("place"), str) or not str(result.get("place", "")).strip():
                result["place"] = request.query
            result.setdefault("place_en", str(result.get("place", request.query)))
            # Đảm bảo các trường mảng tồn tại
            result.setdefault("photo_spots", _default_trip(request.query)["photo_spots"])
            result.setdefault("packing_hints", _default_trip(request.query)["packing_hints"])
            result.setdefault("safety_tips", _default_trip(request.query)["safety_tips"])
            return result
        raise ValueError("JSON format error")

    except Exception:
        return _default_trip(request.query)


@app.post("/generate-full-itinerary")
async def generate_full_itinerary(request: ItineraryRequest):
    try:
        prompt = (
            f"Lịch trình {request.days} ngày tại {request.query}. Phong cách vui, ấm áp (DUY GO — Duy). "
            "Mỗi ngày có theme. Mỗi slot có period: sang|trua|chieu|toi. "
            "BẮT BUỘC mỗi slot có thêm: vehicle (phương tiện, VD: xe máy, Grab, xe buýt, đi bộ), "
            "duration (thời gian dự kiến, VD: 25 phút), food (món đặc sản/ăn gợi ý tại điểm đó, ngắn). "
            "Trả về JSON duy nhất: "
            '{"itinerary":[{"day":1,"theme":"...","slots":['
            '{"period":"sang","time":"07:00","activity":"...","note":"...","joke":"...",'
            '"vehicle":"...","duration":"...","food":"..."}'
            "]}]} "
        )

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
        )

        result = extract_json(response.choices[0].message.content)
        if result and isinstance(result.get("itinerary"), list):
            # Chuẩn hóa period cho từng slot
            for day in result["itinerary"]:
                slots = day.get("slots") or []
                if not isinstance(slots, list):
                    continue
                for i, slot in enumerate(slots):
                    if not isinstance(slot, dict):
                        continue
                    p = str(slot.get("period", "")).lower()
                    if p not in ("sang", "trua", "chieu", "toi"):
                        slot["period"] = ["sang", "trua", "chieu", "toi"][min(i, 3)]
            return result
        return {"error": "Không thể tạo lịch trình", "itinerary": []}
    except Exception:
        return {"error": "Lỗi kết nối Duy", "itinerary": []}


@app.get("/")
async def root():
    return {"status": "Online", "app": "DUY GO"}
