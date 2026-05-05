from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import planner
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DUY GO — Siêu Ứng Dụng Du Lịch")

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký router
app.include_router(planner.router, prefix="/api", tags=["Planner"])

@app.get("/")
async def root():
    return {
        "status": "Duy đang thức!",
        "app": "DUY GO",
        "version": "2.0.0 (Super App Overhaul)"
    }
