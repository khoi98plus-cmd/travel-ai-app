from duckduckgo_search import DDGS

def get_place_image_url(place_name: str) -> str:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(keywords=f"{place_name} travel", max_results=1))
            if results:
                return results[0]['image']
    except Exception:
        pass
    return "https://unsplash.com"
