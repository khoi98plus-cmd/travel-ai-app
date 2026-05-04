import openai
import json
from app.services.image_service import get_place_image_url

class AIService:
    @staticmethod
    async def generate_travel_plan(user_query: str):
        prompt = f"""
        Bạn là chuyên gia du lịch. Hãy lên lịch trình chi tiết cho: {user_query}.
        Phản hồi BẮT BUỘC bằng JSON chuẩn sau:
        {{
          "trip_name": "Tên chuyến đi",
          "days": [
            {{
              "day": 1,
              "activities": [
                {{
                  "place_name": "Tên địa điểm cụ thể",
                  "description": "Mô tả ngắn gọn, hấp dẫn"
                }}
              ]
            }}
          ]
        }}
        """

        response = await openai.ChatCompletion.acreate(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" },
            temperature=0.7
        )

        data = json.loads(response.choices[0].message.content)
        
        # Gắn ảnh miễn phí cho từng địa điểm
        for day in data.get('days', []):
            for activity in day.get('activities', []):
                name = activity.get('place_name')
                activity['image_url'] = get_place_image_url(name)
                
        return data
