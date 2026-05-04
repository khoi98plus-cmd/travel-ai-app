from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt

# Bí mật để mã hóa Token (Sếp có thể đổi chuỗi này tùy ý)
SECRET_KEY = "TRUONG_KHOI_SECRET_KEY_STARTUP_2024"
ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Tạo token cho user khi đăng nhập"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
