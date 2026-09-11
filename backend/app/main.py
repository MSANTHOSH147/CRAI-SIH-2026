from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.routes import router
from app.database import Base, engine
from app.models.sensor_request import SensorAcquisitionRequest
from app.models.pending_analysis import PendingFieldAnalysis
from app.models.field_sensor import FieldSensorReading
from app.models.observation import FieldObservation

# ------------------------------------------------------------
# SQLAlchemy model registration
# ------------------------------------------------------------

from app.models.farm import Farm
from app.models.sensor import SensorData
from app.models.field_sensor import FieldSensorReading
from app.models.observation import FieldObservation

# ------------------------------------------------------------
# Legacy Risk AI
# ------------------------------------------------------------

from app.services.risk_service import (
    predict_risk,
    get_model_info,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="CRAI API",
    description="Crop Assisted AI - Agricultural Monitoring System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RiskAnalysisRequest(BaseModel):
    crop: str = "Tomato"
    disease: str = "Tomato_Healthy"
    disease_confidence: float = 0.0

    temperature: float = 0.0
    humidity: float = 0.0
    thermal_anomaly: float = 0.0

    infected_neighbor_count: int = 0
    total_neighbor_count: int = 0

    disease_density: float = 0.0
    cluster_density: float = 0.0

    observation_count: int = 1

    growth_stage: str = "Vegetative"


app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "CRAI API is running",
        "project": "Crop Assisted AI",
        "version": "0.1.0",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CRAI backend",
    }
@app.post("/api/risk/analyze")
def analyze_risk(request: RiskAnalysisRequest):

    try:
        result = predict_risk(
            request.model_dump()
        )

        return result

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Risk AI prediction failed: {exc}",
        )


@app.get("/api/risk/status")
def risk_status():

    try:
        return get_model_info()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Risk AI unavailable: {exc}",
        )