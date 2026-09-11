from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class FieldSensorReadingCreate(BaseModel):
    device_id: str = Field(min_length=1, max_length=100)

    farm_id: Optional[int] = None
    zone_id: Optional[str] = Field(default=None, max_length=50)

    source: Literal[
        "REAL",
        "SIMULATED",
        "ESTIMATED",
        "USER_ENTERED",
    ] = "REAL"

    soil_moisture: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
    )

    temperature: Optional[float] = Field(
        default=None,
        ge=-20,
        le=80,
    )

    humidity: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
    )

    timestamp: Optional[datetime] = None


class FieldSensorReadingResponse(BaseModel):
    reading_id: str
    status: str
    device_id: str

    farm_id: Optional[int]
    zone_id: Optional[str]

    source: str

    soil_moisture: Optional[float]
    temperature: Optional[float]
    humidity: Optional[float]

    timestamp: datetime