from duckduckgo_search import DDGS

def get_image_url(place_name: str):
    """Lấy ảnh miễn phí không cần API Key"""
    try:
        with DDGS() as ddgs:
            # Tìm ảnh chất lượng cao cho địa điểm
            results = list(ddgs.images(keywords=f"{place_name} travel", max_results=1))
            if results:
                return results[0]['image']
    except Exception as e:
        print(f"Lỗi lấy ảnh: {e}")
    # Ảnh mặc định nếu lỗi
    return "https://unsplash.com"

# Trong hàm trả về Itinerary của bạn, hãy dùng nó như sau:
# for activity in itinerary['activities']:
#     activity['image_url'] = get_image_url(activity['place_name'])
