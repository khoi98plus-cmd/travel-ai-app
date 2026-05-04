import urllib.parse
from app.core.config import settings

class AffiliateService:
    @staticmethod
    def create_booking_link(query: str) -> str:
        base_url = "https://booking.com"
        # Sử dụng AID mặc định hoặc rỗng để không bị lỗi
        aid = getattr(settings, "BOOKING_AID", "000000") or "000000"
        params = {
            "ss": query,
            "aid": aid,
            "lang": "vi"
        }
        return f"{base_url}?{urllib.parse.urlencode(params)}"

    @staticmethod
    def enrich_itinerary(itinerary_data: dict):
        # Đảm bảo itinerary_data là dict và có key 'days'
        if not isinstance(itinerary_data, dict):
            return {"error": "Dữ liệu không hợp lệ"}
            
        for day in itinerary_data.get("days", []):
            for activity in day.get("activities", []):
                query = activity.get("place_name", "Khách sạn")
                activity["booking_url"] = AffiliateService.create_booking_link(query)
        return itinerary_data
