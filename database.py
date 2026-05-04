import redis
import json
import os

# Kết nối tới container Redis
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"), 
    port=6379, 
    db=0, 
    decode_responses=True
)

def get_cached_data(key: str):
    data = redis_client.get(key)
    return json.loads(data) if data else None

def set_cached_data(key: str, value: dict, expire_seconds: int = 86400):
    # Mặc định lưu cache trong 24 giờ (86400s)
    redis_client.setex(key, expire_seconds, json.dumps(value))
