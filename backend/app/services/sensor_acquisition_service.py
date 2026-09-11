from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import uuid

from sqlalchemy.orm import Session

from app.models.sensor_request import (
    SensorAcquisitionRequest,
)

from app.models.pending_analysis import (
    PendingFieldAnalysis,
)

from app.models.field_sensor import (
    FieldSensorReading,
)

from app.services.analysis_service import (
    analyze_field_observation,
)

from app.services.observation_service import (
    get_temporal_history,
    get_spatial_context,
    save_field_observation,
)


# ============================================================
# CONFIGURATION
# ============================================================

REQUEST_EXPIRY_MINUTES = 10

MAX_FRESH_READING_AGE_MINUTES = 15

FUTURE_CLOCK_TOLERANCE_MINUTES = 5


# ============================================================
# REQUEST ID
# ============================================================

def _generate_request_id() -> str:
    return (
        "REQ-"
        + datetime.utcnow().strftime(
            "%Y%m%d%H%M%S"
        )
        + "-"
        + uuid.uuid4().hex[:8].upper()
    )


# ============================================================
# NORMALIZE ZONE
# ============================================================

def _normalize_zone(
    zone_id: Optional[str],
) -> Optional[str]:

    if not zone_id:
        return None

    value = str(
        zone_id
    ).strip().upper()

    return value or None


# ============================================================
# CREATE REQUEST
# ============================================================

def create_sensor_acquisition_request(
    db: Session,
    *,
    farm_id: Optional[int],
    zone_id: Optional[str],
    device_id: Optional[str] = None,
    requested_evidence: str = "FRESH_SENSOR",
    source: str = "ESP32",
    reason: Optional[str] = None,
    priority: str = "MEDIUM",
) -> SensorAcquisitionRequest:

    zone_id = _normalize_zone(
        zone_id
    )

    # --------------------------------------------------------
    # Avoid duplicate active requests
    # --------------------------------------------------------

    existing = (
        db.query(
            SensorAcquisitionRequest
        )
        .filter(
            SensorAcquisitionRequest.status.in_(
                [
                    "PENDING",
                    "CLAIMED",
                ]
            )
        )
        .filter(
            SensorAcquisitionRequest.zone_id
            == zone_id
        )
    )

    if farm_id is not None:
        existing = existing.filter(
            SensorAcquisitionRequest.farm_id
            == farm_id
        )

    existing_request = (
        existing
        .order_by(
            SensorAcquisitionRequest.created_at.desc()
        )
        .first()
    )

    if existing_request:

        return existing_request

    now = datetime.utcnow()

    request = SensorAcquisitionRequest(

        request_id=(
            _generate_request_id()
        ),

        farm_id=farm_id,

        zone_id=zone_id,

        device_id=device_id,

        source=source,

        requested_evidence=(
            requested_evidence
        ),

        reason=reason,

        priority=priority,

        status="PENDING",

        created_at=now,

        expires_at=(
            now
            + timedelta(
                minutes=REQUEST_EXPIRY_MINUTES
            )
        ),
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return request


# ============================================================
# SAVE PENDING ANALYSIS
# ============================================================

def save_pending_analysis(
    db: Session,
    *,
    request_id: str,
    farm_id: Optional[int],
    zone_id: Optional[str],
    crop: str,
    growth_stage: str,
    filename: Optional[str],
    image_path: str,
    prediction: Optional[str],
    confidence: Optional[float],
    image_quality: Optional[dict],
    evidence_gap: Optional[str],
    reason: Optional[str],
) -> PendingFieldAnalysis:

    existing = (
        db.query(
            PendingFieldAnalysis
        )
        .filter(
            PendingFieldAnalysis.request_id
            == request_id
        )
        .first()
    )

    if existing:
        return existing

    pending = PendingFieldAnalysis(

        request_id=request_id,

        farm_id=farm_id,

        zone_id=_normalize_zone(
            zone_id
        ),

        crop=crop,

        growth_stage=growth_stage,

        filename=filename,

        image_path=str(
            image_path
        ),

        prediction=prediction,

        confidence=confidence,

        image_quality=image_quality,

        evidence_gap=evidence_gap,

        reason=reason,

        status="PENDING",

        created_at=datetime.utcnow(),
    )

    db.add(pending)
    db.commit()
    db.refresh(pending)

    return pending


# ============================================================
# GET PENDING REQUESTS
# ============================================================

def get_pending_sensor_requests(
    db: Session,
    *,
    zone_id: Optional[str] = None,
    farm_id: Optional[int] = None,
    device_id: Optional[str] = None,
):

    query = (
        db.query(
            SensorAcquisitionRequest
        )
        .filter(
            SensorAcquisitionRequest.status
            == "PENDING"
        )
    )

    if zone_id:

        query = query.filter(
            SensorAcquisitionRequest.zone_id
            == _normalize_zone(zone_id)
        )

    if farm_id is not None:

        query = query.filter(
            SensorAcquisitionRequest.farm_id
            == farm_id
        )

    if device_id:

        query = query.filter(
            SensorAcquisitionRequest.device_id
            == device_id
        )

    return (
        query
        .order_by(
            SensorAcquisitionRequest.created_at.asc()
        )
        .all()
    )


# ============================================================
# CLAIM REQUEST
# ============================================================

def claim_sensor_request(
    db: Session,
    request_id: str,
):

    request = (
        db.query(
            SensorAcquisitionRequest
        )
        .filter(
            SensorAcquisitionRequest.request_id
            == request_id
        )
        .first()
    )

    if not request:
        return None

    if request.status != "PENDING":
        return request

    now = datetime.utcnow()

    if (
        request.expires_at
        and now > request.expires_at
    ):

        request.status = "EXPIRED"

        db.commit()

        return request

    request.status = "CLAIMED"

    request.claimed_at = now

    db.commit()
    db.refresh(request)

    return request


# ============================================================
# VALIDATE SENSOR READING
# ============================================================

def validate_sensor_reading(
    *,
    soil_moisture=None,
    temperature=None,
    humidity=None,
    timestamp=None,
) -> dict:

    errors = []

    # --------------------------------------------------------
    # Soil moisture
    # --------------------------------------------------------

    if soil_moisture is not None:

        try:
            value = float(
                soil_moisture
            )

            if not 0 <= value <= 100:

                errors.append(
                    "soil_moisture must be between 0 and 100"
                )

        except (
            TypeError,
            ValueError,
        ):

            errors.append(
                "soil_moisture must be numeric"
            )

    # --------------------------------------------------------
    # Humidity
    # --------------------------------------------------------

    if humidity is not None:

        try:
            value = float(
                humidity
            )

            if not 0 <= value <= 100:

                errors.append(
                    "humidity must be between 0 and 100"
                )

        except (
            TypeError,
            ValueError,
        ):

            errors.append(
                "humidity must be numeric"
            )

    # --------------------------------------------------------
    # Temperature
    # --------------------------------------------------------

    if temperature is not None:

        try:
            value = float(
                temperature
            )

            if not -20 <= value <= 70:

                errors.append(
                    "temperature must be between -20 and 70 C"
                )

        except (
            TypeError,
            ValueError,
        ):

            errors.append(
                "temperature must be numeric"
            )

    # --------------------------------------------------------
    # Timestamp
    # --------------------------------------------------------

    reading_time = timestamp

    if reading_time is None:

        errors.append(
            "timestamp is required"
        )

    else:

        if isinstance(
            reading_time,
            str,
        ):

            try:

                text = reading_time

                if text.endswith("Z"):
                    text = (
                        text[:-1]
                        + "+00:00"
                    )

                reading_time = (
                    datetime.fromisoformat(
                        text
                    )
                )

            except (
                TypeError,
                ValueError,
            ):

                errors.append(
                    "timestamp is invalid"
                )

    # --------------------------------------------------------
    # Freshness
    # --------------------------------------------------------

    age_minutes = None

    if isinstance(
        reading_time,
        datetime,
    ):

        if reading_time.tzinfo:

            now = datetime.now(
                reading_time.tzinfo
            )

        else:

            now = datetime.utcnow()

        age_minutes = (
            (
                now
                - reading_time
            ).total_seconds()
            / 60.0
        )

        if (
            age_minutes
            < -FUTURE_CLOCK_TOLERANCE_MINUTES
        ):

            errors.append(
                "timestamp is too far in the future"
            )

        elif (
            age_minutes
            > MAX_FRESH_READING_AGE_MINUTES
        ):

            errors.append(
                "sensor reading is not fresh"
            )

    return {

        "valid":
            len(errors) == 0,

        "errors":
            errors,

        "age_minutes":
            age_minutes,
    }


# ============================================================
# FIND MATCHING REQUEST
# ============================================================

def find_matching_request(
    db: Session,
    *,
    farm_id: Optional[int],
    zone_id: Optional[str],
    device_id: Optional[str],
):

    zone_id = _normalize_zone(
        zone_id
    )

    query = (
        db.query(
            SensorAcquisitionRequest
        )
        .filter(
            SensorAcquisitionRequest.status.in_(
                [
                    "PENDING",
                    "CLAIMED",
                ]
            )
        )
        .filter(
            SensorAcquisitionRequest.zone_id
            == zone_id
        )
    )

    if farm_id is not None:

        query = query.filter(
            SensorAcquisitionRequest.farm_id
            == farm_id
        )

    # --------------------------------------------------------
    # Prefer exact device match.
    # --------------------------------------------------------

    if device_id:

        exact = (
            query
            .filter(
                SensorAcquisitionRequest.device_id
                == device_id
            )
            .order_by(
                SensorAcquisitionRequest.created_at.desc()
            )
            .first()
        )

        if exact:
            return exact

    # --------------------------------------------------------
    # Otherwise allow a zone request with no fixed device.
    # --------------------------------------------------------

    return (
        query
        .filter(
            SensorAcquisitionRequest.device_id
            .is_(None)
        )
        .order_by(
            SensorAcquisitionRequest.created_at.desc()
        )
        .first()
    )


# ============================================================
# FULFILL REQUEST
# ============================================================

def fulfill_sensor_request(
    db: Session,
    *,
    reading: FieldSensorReading,
):

    request = find_matching_request(

        db,

        farm_id=reading.farm_id,

        zone_id=reading.zone_id,

        device_id=reading.device_id,
    )

    if not request:

        return {
            "matched":
                False,

            "request":
                None,

            "reanalyzed":
                False,

            "analysis":
                None,
        }

    # --------------------------------------------------------
    # Validate freshness
    # --------------------------------------------------------

    validation = validate_sensor_reading(

        soil_moisture=(
            reading.soil_moisture
        ),

        temperature=(
            reading.temperature
        ),

        humidity=(
            reading.humidity
        ),

        timestamp=(
            reading.timestamp
        ),
    )

    if not validation["valid"]:

        return {
            "matched":
                True,

            "request":
                request,

            "reanalyzed":
                False,

            "validation":
                validation,

            "analysis":
                None,
        }

    # --------------------------------------------------------
    # Mark request fulfilled
    # --------------------------------------------------------

    request.status = "FULFILLED"

    request.completed_at = (
        datetime.utcnow()
    )

    request.fulfilled_reading_id = (
        reading.reading_id
    )

    db.commit()
    db.refresh(request)

    # --------------------------------------------------------
    # Find pending analysis
    # --------------------------------------------------------

    pending = (
        db.query(
            PendingFieldAnalysis
        )
        .filter(
            PendingFieldAnalysis.request_id
            == request.request_id
        )
        .filter(
            PendingFieldAnalysis.status
            == "PENDING"
        )
        .first()
    )

    if not pending:

        return {
            "matched":
                True,

            "request":
                request,

            "reanalyzed":
                False,

            "validation":
                validation,

            "analysis":
                None,

            "reason":
                "Sensor request fulfilled but no pending analysis exists.",
        }

    # --------------------------------------------------------
    # Verify image exists
    # --------------------------------------------------------

    image_path = Path(
        pending.image_path
    )

    if not image_path.exists():

        pending.status = "FAILED"

        db.commit()

        return {
            "matched":
                True,

            "request":
                request,

            "reanalyzed":
                False,

            "validation":
                validation,

            "analysis":
                None,

            "reason":
                "Pending analysis image is missing.",
        }

    # ========================================================
    # LOAD CURRENT FIELD CONTEXT
    # ========================================================

    history = get_temporal_history(

        db,

        zone_id=pending.zone_id,

        crop=pending.crop,

        farm_id=pending.farm_id,
    )

    spatial_context = get_spatial_context(

        db,

        zone_id=pending.zone_id,

        farm_id=pending.farm_id,
    )

    # ========================================================
    # SENSOR DICT
    # ========================================================

    sensor = {

        "available":
            True,

        "device_id":
            reading.device_id,

        "farm_id":
            reading.farm_id,

        "zone_id":
            reading.zone_id,

        "soil_moisture":
            reading.soil_moisture,

        "temperature":
            reading.temperature,

        "humidity":
            reading.humidity,

        "timestamp":
            (
                reading.timestamp.isoformat()
                if reading.timestamp
                else None
            ),

        "source":
            reading.source,
    }

    # ========================================================
    # RE-ANALYSIS
    # ========================================================

    analysis = analyze_field_observation(

        prediction=(
            pending.prediction
        ),

        confidence=(
            pending.confidence
        ),

        crop=(
            pending.crop
        ),

        growth_stage=(
            pending.growth_stage
        ),

        temperature=(
            reading.temperature
            if reading.temperature is not None
            else 0.0
        ),

        humidity=(
            reading.humidity
            if reading.humidity is not None
            else 0.0
        ),

        thermal_anomaly=0.0,

        infected_neighbor_count=(
            spatial_context.get(
                "infected_neighbors"
            )
            if spatial_context
            else None
        ),

        total_neighbor_count=(
            spatial_context.get(
                "nearby_observations"
            )
            if spatial_context
            else None
        ),

        disease_density=None,

        cluster_density=None,

        observation_count=max(
            1,
            len(
                history or []
            ) + 1,
        ),

        sensor=sensor,

        spatial_context=(
            spatial_context
        ),

        history=history,

        second_image_available=False,

        thermal_available=False,

        image_quality=(
            pending.image_quality
        ),
    )

    # ========================================================
    # SAVE COMPLETED OBSERVATION
    # ========================================================

    if (
        isinstance(
            analysis,
            dict,
        )
        and analysis.get(
            "status"
        )
        == "ANALYSIS_COMPLETE"
    ):

        save_field_observation(

            db,

            zone_id=(
                pending.zone_id
                or "UNKNOWN"
            ),

            crop=(
                pending.crop
            ),

            growth_stage=(
                pending.growth_stage
            ),

            filename=(
                pending.filename
            ),

            prediction=(
                pending.prediction
            ),

            confidence=(
                pending.confidence
            ),

            risk=(
                analysis.get(
                    "risk"
                )
            ),

            sensor=sensor,

            source="FIELD_IMAGE_REANALYSIS",

            farm_id=(
                pending.farm_id
            ),
        )

        pending.status = "COMPLETED"

        pending.completed_at = (
            datetime.utcnow()
        )

    else:

        pending.status = "REANALYSIS_REQUIRED"

    db.commit()

    # --------------------------------------------------------
    # Cleanup pending image
    # --------------------------------------------------------

    try:

        image_path.unlink()

    except OSError:
        pass

    return {

        "matched":
            True,

        "request":
            request,

        "reanalyzed":
            True,

        "validation":
            validation,

        "analysis":
            analysis,
    }