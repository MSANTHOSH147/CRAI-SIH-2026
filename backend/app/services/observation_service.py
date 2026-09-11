from datetime import datetime
from typing import Optional
import hashlib
import uuid

from sqlalchemy.orm import Session

from app.models.observation import FieldObservation


# ============================================================
# HELPERS
# ============================================================

def normalize_zone(zone_id: Optional[str]) -> Optional[str]:
    if not zone_id:
        return None

    return zone_id.strip().upper()


def is_disease_prediction(prediction: Optional[str]) -> bool:
    if not prediction:
        return False

    return "healthy" not in prediction.lower()


# ============================================================
# TEMPORAL CONTEXT
# ============================================================

def get_temporal_history(
    db: Session,
    *,
    zone_id: str,
    crop: Optional[str] = None,
    farm_id: Optional[int] = None,
    limit: int = 10,
) -> list[dict]:
    """
    Return previous completed observations for the
    same field zone.

    IMPORTANT:
    The current observation has NOT been inserted yet,
    so this contains only genuine previous observations.
    """

    zone = normalize_zone(zone_id)

    query = (
        db.query(FieldObservation)
        .filter(
            FieldObservation.zone_id == zone
        )
    )

    if farm_id is not None:
        query = query.filter(
            FieldObservation.farm_id == farm_id
        )

    if crop:
        query = query.filter(
            FieldObservation.crop == crop
        )

    observations = (
        query
        .order_by(
            FieldObservation.observed_at.desc()
        )
        .limit(limit)
        .all()
    )

    # Fusion expects chronological history.
    observations.reverse()

    return [
        {
            "observation_id": item.observation_id,
            "zone_id": item.zone_id,
            "timestamp": item.observed_at.isoformat()
            if item.observed_at
            else None,
            "disease": item.prediction,
            "confidence": item.disease_confidence,
            "risk_score": item.risk_score,
            "risk_level": item.risk_level,
        }
        for item in observations
    ]


# ============================================================
# SPATIAL CONTEXT
# ============================================================

def get_spatial_context(
    db: Session,
    *,
    zone_id: str,
    farm_id: Optional[int] = None,
    limit: int = 100,
) -> Optional[dict]:
    """
    Build spatial evidence from previously observed zones
    belonging to the same farm.

    We deliberately do NOT invent physical distances.

    Until actual zone coordinates / field geometry are
    available, CRAI treats other observed zones in the
    same farm as field-level spatial context.
    """

    zone = normalize_zone(zone_id)

    query = db.query(
        FieldObservation
    )

    if farm_id is not None:
        query = query.filter(
            FieldObservation.farm_id == farm_id
        )

    query = query.filter(
        FieldObservation.zone_id != zone
    )

    observations = (
        query
        .order_by(
            FieldObservation.observed_at.desc()
        )
        .limit(limit)
        .all()
    )

    if not observations:
        return None

    # --------------------------------------------------------
    # Keep only the latest observation for each zone.
    #
    # This prevents one zone with many scans from dominating
    # the spatial signal.
    # --------------------------------------------------------

    latest_by_zone = {}

    for item in observations:
        item_zone = normalize_zone(
            item.zone_id
        )

        if not item_zone:
            continue

        if item_zone not in latest_by_zone:
            latest_by_zone[item_zone] = item

    latest_observations = list(
        latest_by_zone.values()
    )

    if not latest_observations:
        return None

    infected = sum(
        1
        for item in latest_observations
        if is_disease_prediction(
            item.prediction
        )
    )

    return {
        "available": True,
        "nearby_observations": len(
            latest_observations
        ),
        "infected_neighbors": infected,
        "observed_zones": sorted(
            latest_by_zone.keys()
        ),
        "scope": "same_farm_observed_zones",
    }


# ============================================================
# FARM RESOLUTION
# ============================================================

def resolve_farm_id_from_sensor(
    db: Session,
    zone_id: Optional[str],
):
    """
    Resolve farm ownership from the latest zone sensor.

    This avoids assuming that zone A1/C3 belongs to a
    particular farm.
    """

    if not zone_id:
        return None

    from app.models.field_sensor import (
        FieldSensorReading,
    )

    zone = normalize_zone(zone_id)

    reading = (
        db.query(FieldSensorReading)
        .filter(
            FieldSensorReading.zone_id == zone
        )
        .order_by(
            FieldSensorReading.timestamp.desc()
        )
        .first()
    )

    if not reading:
        return None

    return reading.farm_id


# ============================================================
# SAVE OBSERVATION
# ============================================================

def save_field_observation(
    db: Session,
    *,
    zone_id: str,
    crop: str,
    growth_stage: str,
    filename: Optional[str],
    prediction: Optional[str],
    confidence: Optional[float],
    risk: Optional[dict],
    sensor: Optional[dict],
    source: str = "FIELD_IMAGE",
    image_bytes: Optional[bytes] = None,
    farm_id: Optional[int] = None,
) -> FieldObservation:
    """
    Persist one completed CRAI field observation.

    Only completed risk assessments should call this function.
    """

    zone = normalize_zone(zone_id)

    image_sha256 = None

    if image_bytes:
        image_sha256 = hashlib.sha256(
            image_bytes
        ).hexdigest()

    breakdown = None
    evidence_summary = None
    risk_score = None
    risk_level = None
    assessment_confidence = None

    if risk:
        risk_score = risk.get(
            "risk_score"
        )

        risk_level = risk.get(
            "risk_level"
        )

        assessment_confidence = risk.get(
            "assessment_confidence"
        )

        breakdown = risk.get(
            "breakdown"
        )

        evidence_summary = risk.get(
            "evidence_summary"
        )

    observation = FieldObservation(
        observation_id=(
            f"OBS-"
            f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-"
            f"{uuid.uuid4().hex[:8].upper()}"
        ),

        farm_id=farm_id,

        zone_id=zone,

        crop=crop,

        growth_stage=growth_stage,

        observed_at=datetime.utcnow(),

        filename=filename,

        image_sha256=image_sha256,

        prediction=prediction,

        disease_confidence=confidence,

        risk_score=risk_score,

        risk_level=risk_level,

        assessment_confidence=(
            assessment_confidence
        ),

        soil_moisture=(
            sensor.get("soil_moisture")
            if sensor
            else None
        ),

        temperature=(
            sensor.get("temperature")
            if sensor
            else None
        ),

        humidity=(
            sensor.get("humidity")
            if sensor
            else None
        ),

        thermal_anomaly=None,

        evidence_breakdown=breakdown,

        evidence_summary=evidence_summary,

        source=source,
    )

    db.add(observation)
    db.commit()
    db.refresh(observation)

    return observation