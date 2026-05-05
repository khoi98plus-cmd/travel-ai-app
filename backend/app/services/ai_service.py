import openai
import json
from app.services.image_service import get_place_image_url

class AIService:
    @staticmethod
    async def generate_itinerary(destination: str, days: int = 1, origin: str = "Sài Gòn", mood: str = "chill", budget: str = "standard", preferences: str = ""):
        prompt = f"""
        Bạn là DUY - một AI du lịch hài hước, tinh tế, xưng hô là 'Duy' và gọi người dùng là 'tri kỷ'.
        Phong cách nói chuyện: Gen Z, dùng emoji, cực kỳ quan tâm (nhắc mang ô, gợi ý góc sống ảo).
        
        Nhiệm vụ: Lên kế hoạch du lịch từ {origin} đi {destination} trong {days} ngày.
        Tâm trạng người dùng: {mood}
        Ngân sách: {budget}
        Yêu cầu thêm: {preferences}
        
        BẮT BUỘC trả về JSON format sau:
        {{
          "trip_name": "Tên chuyến đi cực chill",
          "duy_intro": "Lời chào của Duy theo phong cách Gen Z",
          "inspiration": {{
            "why_visit": "Tại sao phải đến đây ít nhất một lần? (Ngôn từ lôi cuốn, ham muốn)",
            "photo_spots_pro": "Góc chụp triệu like (mô tả tinh tế)",
            "must_eat_pro": "Món phải ăn (kèm mô tả hương vị hấp dẫn)"
          }},
          "image_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
          "budget_analysis": "Phân tích ngân sách {budget} cho chuyến đi này",
          "weather_advice": "Lời khuyên thời tiết và trang phục",
          "radio_script": "Một đoạn văn ngắn (script) để Duy đọc cho người dùng nghe (Radio Chữa Lành) kèm mô tả nhạc nền Lofi",
          "days": [
            {{
              "day": 1,
              "activities": [
                {{
                  "time": "Sáng/Trưa/Chiều/Tối",
                  "place_name": "Tên địa điểm",
                  "description": "Mô tả địa điểm + 'Góc của Duy' (gợi ý góc chụp ảnh đẹp)",
                  "cost_estimate": "Ước tính chi phí VND"
                }}
              ]
            }}
          ],
          "duy_outro": "Lời chúc của Duy"
        }}
        """

        response = await openai.ChatCompletion.acreate(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": "Bạn là DUY, AI du lịch dẫn đầu xu hướng."}, {"role": "user", "content": prompt}],
            response_format={ "type": "json_object" },
            temperature=0.8
        )

        data = json.loads(response.choices[0].message.content)
        
        # Gắn ảnh cho từng địa điểm
        for day in data.get('days', []):
            for activity in day.get('activities', []):
                name = activity.get('place_name')
                activity['image_url'] = get_place_image_url(name)
                
        return data
