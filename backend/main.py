import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load biến môi trường từ file .env (nếu có)
load_dotenv()

app = FastAPI(title="TVDI AI & WebGIS API", version="1.0.0")

# Bật CORS cho phép Frontend truy cập API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cấu hình Kết nối PostgreSQL
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "your_password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "tvdi_db")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = None
try:
    engine = create_engine(DATABASE_URL)
except Exception as e:
    print(f"⚠️ Cảnh báo: Chưa kết nối được PostgreSQL: {e}")

# Load Mô hình XGBoost
MODEL_PATH = os.path.join(os.path.dirname(__file__), "xgboost_tvdi_model.pkl")
model = None

if os.path.exists(MODEL_PATH):
    try:
        model = joblib.load(MODEL_PATH)
        print("✅ Đã load thành công mô hình XGBoost!")
    except Exception as e:
        print(f"❌ Lỗi khi load model: {e}")
else:
    print("⚠️ Cảnh báo: File xgboost_tvdi_model.pkl chưa được đặt trong thư mục backend/")

# Schema dữ liệu đầu vào
class PredictRequest(BaseModel):
    ndvi: float
    lst: float
    month: int
    x_coord: float = 106.7009
    y_coord: float = 10.7769

@app.get("/")
def root():
    return {"status": "Online", "service": "TVDI Drought Forecast API"}

@app.post("/api/predict-tvdi")
def predict_tvdi(req: PredictRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Mô hình AI chưa được nạp trên Server.")
    
    # Kỹ thuật Cyclical Encoding cho Tháng
    thang_sin = np.sin(2 * np.pi * req.month / 12.0)
    thang_cos = np.cos(2 * np.pi * req.month / 12.0)
    
    # Đưa dữ liệu đầu vào đúng định dạng tính toán
    features = np.array([[req.ndvi, req.lst, thang_sin, thang_cos, req.x_coord, req.y_coord]])
    
    # Dự báo TVDI
    predicted_tvdi = float(model.predict(features)[0])
    predicted_tvdi = max(0.0, min(1.0, predicted_tvdi)) # Giới hạn trong khoảng [0, 1]
    
    # Phân loại mức độ khô hạn theo TVDI
    if predicted_tvdi < 0.2:
        status = "Không khô hạn (Ẩm ướt)"
        color = "#066b00"
    elif predicted_tvdi < 0.4:
        status = "Khô nhẹ"
        color = "#00ff00"
    elif predicted_tvdi < 0.6:
        status = "Khô trung bình"
        color = "#ffff00"
    elif predicted_tvdi < 0.8:
        status = "Khô nặng"
        color = "#ff6600"
    else:
        status = "Khô hạn cực kỳ nghiêm trọng"
        color = "#ff0000"
        
    return {
        "predicted_tvdi": round(predicted_tvdi, 4),
        "drought_status": status,
        "color_code": color
    }

@app.get("/api/tvdi-history")
def get_tvdi_history(limit: int = 50):
    if engine is None:
        return []
    try:
        query = f"SELECT x_coord, y_coord, observation_date, ndvi, lst, tvdi FROM tvdi_observations ORDER BY observation_date DESC LIMIT {limit}"
        df = pd.read_sql(query, engine)
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}
