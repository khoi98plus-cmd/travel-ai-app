from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "TravellerAI"
    # Chỉ bắt buộc OpenAI, các cái khác cho phép None hoặc mặc định
    OPENAI_API_KEY: str 
    GOOGLE_MAPS_API_KEY: Optional[str] = ""
    BOOKING_AID: Optional[str] = "000000"
    SECRET_KEY: str = "mot_day_ky_tu_bi_mat"

    class Config:
        env_file = ".env"

settings = Settings()
