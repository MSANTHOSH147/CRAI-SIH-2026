"""
CRAI LOCAL FARMER ADVISORY

Qwen3 is an explanation-only layer.

AUTHORITATIVE CRAI OUTPUTS:
- disease prediction
- disease-model confidence
- field risk score
- risk level
- assessment confidence
- deterministic decision
- priority
- sensor values
- spatial evidence
- temporal evidence

Qwen3 NEVER calculates or changes CRAI risk.

Supported farmer languages:
- English
- Tamil
- Hindi
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

import requests


# ============================================================
# CONFIG
# ============================================================

OLLAMA_BASE_URL = os.getenv(
    "CRAI_OLLAMA_BASE_URL",
    "http://127.0.0.1:11434",
).rstrip("/")

OLLAMA_GENERATE_URL = (
    f"{OLLAMA_BASE_URL}/api/generate"
)

OLLAMA_TAGS_URL = (
    f"{OLLAMA_BASE_URL}/api/tags"
)

OLLAMA_MODEL = os.getenv(
    "CRAI_OLLAMA_MODEL",
    "qwen3:1.7b",
)

# 1.7B model can be slow on CPU.
OLLAMA_TIMEOUT_SECONDS = int(
    os.getenv(
        "CRAI_OLLAMA_TIMEOUT",
        "90",
    )
)

# 120 was causing truncated advisories.
MAX_OUTPUT_TOKENS = int(
    os.getenv(
        "CRAI_OLLAMA_MAX_TOKENS",
        "220",
    )
)

OLLAMA_KEEP_ALIVE = os.getenv(
    "CRAI_OLLAMA_KEEP_ALIVE",
    "10m",
)


# ============================================================
# LANGUAGE
# ============================================================

SUPPORTED_LANGUAGES = {
    "english": "English",
    "en": "English",
    "tamil": "Tamil",
    "ta": "Tamil",
    "hindi": "Hindi",
    "hi": "Hindi",
}


def normalize_language(
    language: Optional[str],
) -> str:

    if not language:
        return "English"

    return SUPPORTED_LANGUAGES.get(
        str(language).strip().lower(),
        "English",
    )


# ============================================================
# SAFE HELPERS
# ============================================================

def _safe(value: Any) -> Any:

    if value is None:
        return None

    if isinstance(
        value,
        (str, int, float, bool),
    ):
        return value

    if isinstance(value, dict):

        return {
            str(k): _safe(v)
            for k, v in value.items()
        }

    if isinstance(value, list):

        return [
            _safe(v)
            for v in value
        ]

    return str(value)


def _first(*values: Any) -> Any:

    for value in values:

        if value is not None:
            return value

    return None


def _number(
    value: Any,
) -> Optional[float]:

    if value is None:
        return None

    try:
        return float(value)

    except (
        TypeError,
        ValueError,
    ):
        return None


def _round_number(
    value: Any,
    digits: int = 2,
) -> Optional[float]:

    number = _number(value)

    if number is None:
        return None

    return round(number, digits)


# ============================================================
# FIELD DATA NORMALIZATION
# ============================================================

def build_farmer_guidance(
    field_data: Dict[str, Any],
) -> Dict[str, Any]:

    if not isinstance(
        field_data,
        dict,
    ):
        field_data = {}

    disease = (
        field_data.get("disease")
        if isinstance(
            field_data.get("disease"),
            dict,
        )
        else {}
    )

    risk = (
        field_data.get("risk")
        if isinstance(
            field_data.get("risk"),
            dict,
        )
        else {}
    )

    decision = (
        field_data.get("decision")
        if isinstance(
            field_data.get("decision"),
            dict,
        )
        else {}
    )

    context = (
        field_data.get("context")
        if isinstance(
            field_data.get("context"),
            dict,
        )
        else {}
    )

    sensor = (
        context.get("sensor")
        if isinstance(
            context.get("sensor"),
            dict,
        )
        else {}
    )

    spatial = (
        context.get("spatial")
        if isinstance(
            context.get("spatial"),
            dict,
        )
        else {}
    )

    temporal = (
        context.get("temporal")
        if isinstance(
            context.get("temporal"),
            dict,
        )
        else {}
    )

    prediction = _first(
        disease.get("prediction"),
        disease.get("disease"),
        field_data.get("disease_signal"),
        field_data.get("prediction"),
    )

    confidence = _first(
        disease.get("confidence"),
        disease.get("model_confidence"),
        field_data.get("model_confidence"),
        field_data.get("confidence"),
    )

    risk_score = _first(
        risk.get("risk_score"),
        field_data.get("field_risk"),
        field_data.get("risk_score"),
    )

    risk_level = _first(
        risk.get("risk_level"),
        field_data.get("risk_level"),
    )

    assessment_confidence = _first(
        risk.get("assessment_confidence"),
        field_data.get("assessment_confidence"),
    )

    soil_moisture = _first(
        sensor.get("soil_moisture"),
        field_data.get("soil_moisture"),
    )

    temperature = _first(
        sensor.get("temperature"),
        field_data.get("temperature"),
    )

    humidity = _first(
        sensor.get("humidity"),
        field_data.get("humidity"),
    )

    timestamp = _first(
        sensor.get("timestamp"),
        field_data.get("sensor_timestamp"),
    )

    freshness = _first(
        sensor.get("freshness"),
        field_data.get("sensor_freshness"),
    )

    age_minutes = _first(
        sensor.get("age_minutes"),
        field_data.get("sensor_age_minutes"),
    )

    usable = _first(
        sensor.get("usable"),
        field_data.get("sensor_usable"),
    )

    infected = _first(
        spatial.get("infected_neighbors"),
        field_data.get("infected_neighbor_count"),
    )

    total = _first(
        spatial.get("total_observed_zones"),
        spatial.get("total_neighbor_count"),
        field_data.get("total_neighbor_count"),
    )

    if (
        infected is not None
        and total is not None
    ):

        try:

            spatial_signal = (
                f"{int(infected)} of "
                f"{int(total)} observed "
                f"zones affected"
            )

        except (
            TypeError,
            ValueError,
        ):

            spatial_signal = None

    else:

        spatial_signal = _first(
            field_data.get("spatial_signal")
        )

    temporal_trend = _first(
        temporal.get("trend"),
        field_data.get("temporal_trend"),
    )

    observation_count = _first(
        temporal.get("observation_count"),
        field_data.get("observation_count"),
    )

    recommended_steps = _first(
        decision.get("recommended_steps"),
        field_data.get("recommended_steps"),
    )

    if not isinstance(
        recommended_steps,
        list,
    ):
        recommended_steps = None

    return {
        "crop": _first(
            field_data.get("crop"),
            "Tomato",
        ),

        "growth_stage": _first(
            field_data.get("growth_stage"),
            "Vegetative",
        ),

        "zone": _first(
            field_data.get("zone"),
            field_data.get("zone_id"),
        ),

        "disease_signal": prediction,

        "model_confidence":
            _round_number(confidence),

        "field_risk":
            _round_number(risk_score),

        "risk_level":
            risk_level,

        "assessment_confidence":
            assessment_confidence,

        "sensor": {
            "soil_moisture":
                _round_number(soil_moisture),

            "temperature":
                _round_number(temperature),

            "humidity":
                _round_number(humidity),

            "timestamp":
                timestamp,

            "freshness":
                freshness,

            "age_minutes":
                _round_number(age_minutes),

            "usable":
                usable,
        },

        "spatial_signal":
            spatial_signal,

        "temporal_trend":
            temporal_trend,

        "observation_count":
            observation_count,

        "decision":
            _first(
                decision.get("action"),
                field_data.get("decision"),
            ),

        "decision_priority":
            _first(
                decision.get("priority"),
                field_data.get("decision_priority"),
            ),

        "recommended_steps":
            recommended_steps,

        "evidence_quality":
            field_data.get("evidence_quality"),

        "uncertainty":
            field_data.get("uncertainty"),
    }


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are the CRAI Farmer Advisor.

You are ONLY an explanation layer.

CRAI's deterministic evidence-fusion engine is authoritative.

NEVER:
- calculate risk
- recalculate risk
- change risk score
- change risk level
- change assessment confidence
- change decision
- change priority
- invent sensor values
- invent weather
- invent treatment
- invent pesticide
- invent dosage
- claim laboratory confirmation
- contradict CRAI evidence

The disease model produces a visual/model signal.
It is NOT laboratory confirmation.

Your job is to explain the supplied CRAI evidence
in a short, natural, farmer-friendly way.

IMPORTANT:
The requested language is mandatory.

If requested language is Tamil:
EVERY normal sentence must be Tamil.

If requested language is Hindi:
EVERY normal sentence must be Hindi.

If requested language is English:
write normal English.

Crop names, disease names, CRAI identifiers,
numbers, percentages and units may remain unchanged.

Do not mix English sentences into Tamil or Hindi.

Do not translate numerical values.

Do not translate technical disease names unless
the requested language naturally requires an
additional explanation.

Return exactly five sections:

Situation:
Why CRAI is concerned:
What to do now:
Next check:
Caution:

Keep the answer concise but COMPLETE.
Do not stop halfway through a sentence.
"""


# ============================================================
# LANGUAGE RULES
# ============================================================

LANGUAGE_RULES = {

    "English": """
Write natural, simple English for a farmer.
Do not use unnecessary technical jargon.
""",

    "Tamil": """
முழுவதும் எளிய, இயல்பான தமிழில் எழுதவும்.

விவசாயி எளிதாக புரிந்து கொள்ளும் வகையில்
சிறிய வாக்கியங்களைப் பயன்படுத்தவும்.

ஆங்கில வாக்கியங்களை பயன்படுத்த வேண்டாம்.

Tomato, Tomato_Late_Blight, CRAI போன்ற
crop/disease/technical identifiers மற்றும்
எண்கள், %, °C, RH போன்ற அளவுகளை அப்படியே வைத்திருக்கலாம்.
""",

    "Hindi": """
पूरी तरह सरल और स्वाभाविक हिन्दी में लिखें।

किसान आसानी से समझ सके ऐसे छोटे वाक्यों का
उपयोग करें।

अंग्रेज़ी के सामान्य वाक्य न लिखें।

Tomato, Tomato_Late_Blight, CRAI जैसे
crop/disease/technical identifiers तथा
संख्या, %, °C, RH जैसी इकाइयों को वैसा ही रख सकते हैं।
""",
}


# ============================================================
# PROMPT BUILDER
# ============================================================

def build_advisory_prompt(
    field_data: Dict[str, Any],
    language: str = "English",
) -> str:

    language = normalize_language(language)

    evidence = build_farmer_guidance(field_data)

    payload = json.dumps(
        _safe(evidence),
        ensure_ascii=False,
        indent=2,
    )

    return f"""
REQUESTED OUTPUT LANGUAGE: {language}

{LANGUAGE_RULES[language]}

MANDATORY LANGUAGE TEST:

Before producing the answer, silently verify:

- Situation is written in {language}
- Why CRAI is concerned is written in {language}
- What to do now is written in {language}
- Next check is written in {language}
- Caution is written in {language}

Do NOT output this verification.

AUTHORITATIVE CRAI FACTS:

Disease-model confidence and field-risk assessment
are different concepts.

The disease model provides the visual signal.

CRAI's deterministic fusion engine provides:
- field risk
- risk level
- assessment confidence
- decision
- priority

Never change these values.

If risk_level is CRITICAL, explain:

"The disease model detected a strong visual signal;
CRAI's deterministic evidence-fusion engine classified
field risk as CRITICAL."

Do NOT say that the disease model itself classified
the field as CRITICAL.

If temporal trend is DECREASING,
do not call it worsening.

If temporal trend is INCREASING,
explain that recent CRAI observations show an increasing trend.

If sensor values exist, use the exact supplied values.

If a sensor value is missing, do not invent it.

If decision is PRIORITIZE_INSPECTION,
tell the farmer that inspection should be prioritized.

Only use the supplied recommended steps.

Do not invent pesticide, fungicide, dosage,
weather or treatment instructions.

STRUCTURED CRAI EVIDENCE:

{payload}

Now produce ONLY the five requested sections:

Situation:
Why CRAI is concerned:
What to do now:
Next check:
Caution:

Use {language} for the complete response.
"""


# ============================================================
# CLEAN OUTPUT
# ============================================================

def _clean_model_output(
    text: Any,
) -> str:

    if text is None:
        return ""

    text = str(text).strip()

    text = re.sub(
        r"^```(?:text)?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"\s*```$",
        "",
        text,
    )

    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    return text.strip()


# ============================================================
# FALLBACK
# ============================================================

def _fallback_value(
    value: Any,
    default: str = "—",
) -> str:

    if value is None:
        return default

    return str(value)


def build_fallback_advisory(
    field_data: Dict[str, Any],
    language: str = "English",
) -> str:

    language = normalize_language(language)

    evidence = build_farmer_guidance(field_data)

    crop = _fallback_value(
        evidence.get("crop"),
        "crop",
    )

    zone = _fallback_value(
        evidence.get("zone"),
        "zone",
    )

    disease = _fallback_value(
        evidence.get("disease_signal"),
        "visual disease signal",
    )

    confidence = evidence.get(
        "model_confidence"
    )

    risk = evidence.get(
        "field_risk"
    )

    risk_level = _fallback_value(
        evidence.get("risk_level"),
        "UNAVAILABLE",
    )

    assessment_confidence = _fallback_value(
        evidence.get("assessment_confidence"),
        "UNAVAILABLE",
    )

    sensor = evidence.get("sensor") or {}

    soil = sensor.get("soil_moisture")
    temp = sensor.get("temperature")
    humidity = sensor.get("humidity")

    spatial = evidence.get("spatial_signal")
    trend = evidence.get("temporal_trend")

    steps = evidence.get(
        "recommended_steps"
    ) or []

    # --------------------------------------------------------
    # ENGLISH
    # --------------------------------------------------------

    if language == "English":

        situation = (
            f"CRAI detected a visual signal of "
            f"{disease} in {crop} at {zone}."
        )

        if confidence is not None:
            situation += (
                f" Model confidence is "
                f"{confidence:.2f}%."
            )

        why = (
            f"CRAI's deterministic evidence-fusion "
            f"engine classified field risk as "
            f"{risk_level}"
        )

        if risk is not None:
            why += f" at {risk:.1f}."

        why += (
            f" Assessment confidence is "
            f"{assessment_confidence}."
        )

        if spatial:
            why += f" {spatial}."

        if trend:
            why += (
                f" Recent CRAI observations show "
                f"a {str(trend).lower()} trend."
            )

        parts = []

        if soil is not None:
            parts.append(
                f"soil moisture {soil:.1f}%"
            )

        if temp is not None:
            parts.append(
                f"temperature {temp:.1f}°C"
            )

        if humidity is not None:
            parts.append(
                f"humidity {humidity:.1f}% RH"
            )

        if parts:
            why += (
                " Current conditions: "
                + ", ".join(parts)
                + "."
            )

        if steps:

            actions = "\n".join(
                f"{i}. {step}"
                for i, step in enumerate(
                    steps[:4],
                    1,
                )
            )

        else:

            actions = (
                "1. Inspect the affected area.\n"
                "2. Follow the CRAI decision.\n"
                "3. Re-observe the zone."
            )

        return (
            f"Situation: {situation}\n\n"
            f"Why CRAI is concerned: {why}\n\n"
            f"What to do now:\n{actions}\n\n"
            f"Next check: Re-observe the affected "
            f"zone after the recommended action.\n\n"
            f"Caution: The disease signal is a "
            f"visual/model prediction, not laboratory confirmation."
        )

    # --------------------------------------------------------
    # TAMIL
    # --------------------------------------------------------

    if language == "Tamil":

        situation = (
            f"{zone} பகுதியில் உள்ள {crop} பயிரில் "
            f"{disease} தொடர்பான காட்சி அறிகுறியை "
            f"CRAI கண்டறிந்துள்ளது."
        )

        if confidence is not None:
            situation += (
                f" நோய் மாதிரி நம்பிக்கை "
                f"{confidence:.2f}%."
            )

        why = (
            f"CRAI-யின் deterministic evidence-fusion "
            f"engine வயல் அபாயத்தை {risk_level} "
            f"என்று வகைப்படுத்தியுள்ளது"
        )

        if risk is not None:
            why += f" ({risk:.1f})."

        why += (
            f" மதிப்பீட்டு நம்பிக்கை "
            f"{assessment_confidence}."
        )

        if spatial:
            why += f" {spatial}."

        if trend:
            trend_map = {
                "INCREASING": "அதிகரித்து வரும்",
                "DECREASING": "குறைந்து வரும்",
                "STABLE": "நிலையான",
            }

            tamil_trend = trend_map.get(
                str(trend).upper(),
                "மாற்றம் உள்ள",
            )

            why += (
                f" சமீபத்திய CRAI பதிவுகளில் "
                f"{tamil_trend} போக்கு உள்ளது."
            )

        parts = []

        if soil is not None:
            parts.append(
                f"மண் ஈரப்பதம் {soil:.1f}%"
            )

        if temp is not None:
            parts.append(
                f"வெப்பநிலை {temp:.1f}°C"
            )

        if humidity is not None:
            parts.append(
                f"காற்றின் ஈரப்பதம் {humidity:.1f}% RH"
            )

        if parts:
            why += (
                " தற்போதைய நிலை: "
                + ", ".join(parts)
                + "."
            )

        tamil_actions = [
            "பாதிக்கப்பட்ட தாவரங்களை முதலில் பரிசோதிக்கவும்.",
            "பிற பாதிக்கப்பட்ட பகுதிகளில் நோய் பரவலுக்கான அறிகுறிகளைப் பார்க்கவும்.",
            f"மண் ஈரப்பதம் {soil:.1f}% என்பதால் பாசனத் தேவையைச் சரிபார்க்கவும்."
            if soil is not None
            else "பாசனத் தேவையைச் சரிபார்க்கவும்.",
            "பரிந்துரைக்கப்பட்ட நடவடிக்கைக்குப் பிறகு அந்த பகுதியை மீண்டும் கவனிக்கவும்.",
        ]

        if not steps:
            tamil_actions = [
                "பாதிக்கப்பட்ட பகுதியை பரிசோதிக்கவும்.",
                "CRAI பரிந்துரைத்த முடிவைப் பின்பற்றவும்.",
                "பின்னர் அந்த பகுதியை மீண்டும் கவனிக்கவும்.",
            ]

        actions = "\n".join(
            f"{i}. {text}"
            for i, text in enumerate(
                tamil_actions[:4],
                1,
            )
        )

        return (
            f"நிலைமை: {situation}\n\n"
            f"CRAI ஏன் கவலைப்படுகிறது: {why}\n\n"
            f"இப்போது செய்ய வேண்டியது:\n{actions}\n\n"
            f"அடுத்த சரிபார்ப்பு: பரிந்துரைக்கப்பட்ட "
            f"நடவடிக்கைக்குப் பிறகு பாதிக்கப்பட்ட "
            f"பகுதியை மீண்டும் கவனிக்கவும்.\n\n"
            f"எச்சரிக்கை: இது காட்சி/மாதிரி அடிப்படையிலான "
            f"அறிகுறி மட்டுமே; ஆய்வக உறுதிப்படுத்தல் அல்ல."
        )

    # --------------------------------------------------------
    # HINDI
    # --------------------------------------------------------

    situation = (
        f"{zone} क्षेत्र में {crop} फसल में "
        f"{disease} का दृश्य संकेत CRAI ने पाया है।"
    )

    if confidence is not None:
        situation += (
            f" मॉडल का confidence {confidence:.2f}% है।"
        )

    why = (
        f"CRAI के deterministic evidence-fusion "
        f"engine ने field risk को {risk_level} "
        f"वर्गीकृत किया है"
    )

    if risk is not None:
        why += f" ({risk:.1f})।"

    why += (
        f" मूल्यांकन confidence "
        f"{assessment_confidence} है।"
    )

    if spatial:
        why += f" {spatial}।"

    if trend:

        trend_map = {
            "INCREASING": "बढ़ता हुआ",
            "DECREASING": "कम होता हुआ",
            "STABLE": "स्थिर",
        }

        hindi_trend = trend_map.get(
            str(trend).upper(),
            "बदलता हुआ",
        )

        why += (
            f" हाल की CRAI observations में "
            f"{hindi_trend} trend है।"
        )

    parts = []

    if soil is not None:
        parts.append(
            f"मिट्टी की नमी {soil:.1f}%"
        )

    if temp is not None:
        parts.append(
            f"तापमान {temp:.1f}°C"
        )

    if humidity is not None:
        parts.append(
            f"हवा की नमी {humidity:.1f}% RH"
        )

    if parts:
        why += (
            " वर्तमान स्थिति: "
            + ", ".join(parts)
            + "।"
        )

    hindi_actions = [
        "प्रभावित पौधों की पहले जाँच करें।",
        "अन्य प्रभावित क्षेत्रों में बीमारी फैलने के संकेत देखें।",
        f"मिट्टी की नमी {soil:.1f}% है, इसलिए सिंचाई की जरूरत जाँचें।"
        if soil is not None
        else "सिंचाई की जरूरत जाँचें।",
        "सुझाई गई कार्रवाई के बाद क्षेत्र को दोबारा देखें।",
    ]

    if not steps:
        hindi_actions = [
            "प्रभावित क्षेत्र की जाँच करें।",
            "CRAI के सुझाए गए निर्णय का पालन करें।",
            "बाद में क्षेत्र को दोबारा देखें।",
        ]

    actions = "\n".join(
        f"{i}. {text}"
        for i, text in enumerate(
            hindi_actions[:4],
            1,
        )
    )

    return (
        f"स्थिति: {situation}\n\n"
        f"CRAI क्यों चिंतित है: {why}\n\n"
        f"अभी क्या करें:\n{actions}\n\n"
        f"अगली जाँच: सुझाई गई कार्रवाई के बाद "
        f"प्रभावित क्षेत्र को दोबारा देखें।\n\n"
        f"सावधानी: यह दृश्य/model संकेत है, "
        f"laboratory confirmation नहीं।"
    )


# ============================================================
# OLLAMA HEALTH
# ============================================================

def check_ollama() -> Dict[str, Any]:

    try:

        response = requests.get(
            OLLAMA_TAGS_URL,
            timeout=5,
        )

        if response.status_code != 200:

            return {
                "available": False,
                "model": OLLAMA_MODEL,
                "model_available": False,
                "error":
                    f"Ollama HTTP {response.status_code}",
            }

        data = response.json()

        models = []

        for item in data.get("models") or []:

            if isinstance(item, dict):

                name = item.get("name")

                if name:
                    models.append(name)

        return {
            "available": True,
            "model": OLLAMA_MODEL,
            "model_available":
                OLLAMA_MODEL in models,
            "models": models,
        }

    except Exception as exc:

        return {
            "available": False,
            "model": OLLAMA_MODEL,
            "model_available": False,
            "error": str(exc),
        }


# ============================================================
# GENERATE LOCAL ADVISORY
# ============================================================

def generate_local_advisory(
    field_data: Dict[str, Any],
    language: str = "English",
) -> Dict[str, Any]:

    language = normalize_language(language)

    grounded_evidence = build_farmer_guidance(
        field_data
    )

    fallback = build_fallback_advisory(
        field_data,
        language,
    )

    prompt = build_advisory_prompt(
        field_data,
        language,
    )

    payload = {
        "model": OLLAMA_MODEL,

        "prompt":
            SYSTEM_PROMPT
            + "\n"
            + prompt,

        "stream": False,

        "think": False,

        "raw": False,

        "keep_alive":
            OLLAMA_KEEP_ALIVE,

        "options": {
            "temperature": 0.10,

            "top_p": 0.70,

            "num_predict":
                MAX_OUTPUT_TOKENS,

            "num_ctx": 4096,

            "repeat_penalty": 1.05,
        },
    }

    try:

        response = requests.post(
            OLLAMA_GENERATE_URL,
            json=payload,
            timeout=(
                10,
                OLLAMA_TIMEOUT_SECONDS,
            ),
        )

        if response.status_code != 200:

            return {
                "available": False,
                "provider": "OLLAMA",
                "model": OLLAMA_MODEL,
                "language": language,
                "advisory": fallback,
                "grounded_evidence":
                    grounded_evidence,
                "offline": True,
                "fallback": True,
                "error":
                    f"Ollama HTTP {response.status_code}",
            }

        data = response.json()

        advisory = _clean_model_output(
            data.get("response")
        )

        if not advisory:

            return {
                "available": False,
                "provider": "OLLAMA",
                "model": OLLAMA_MODEL,
                "language": language,
                "advisory": fallback,
                "grounded_evidence":
                    grounded_evidence,
                "offline": True,
                "fallback": True,
                "error":
                    "Ollama returned empty response.",
            }

        lower = advisory.lower()

        suspicious_patterns = [
            "ignore previous instructions",
            "ignore the instructions",
            "as an ai",
            "i cannot follow",
            "i am unable",
        ]

        if any(
            pattern in lower
            for pattern in suspicious_patterns
        ):

            return {
                "available": False,
                "provider": "OLLAMA",
                "model": OLLAMA_MODEL,
                "language": language,
                "advisory": fallback,
                "grounded_evidence":
                    grounded_evidence,
                "offline": True,
                "fallback": True,
                "error":
                    "Qwen response failed CRAI validation.",
            }

        return {
            "available": True,
            "provider": "OLLAMA",
            "model": OLLAMA_MODEL,
            "language": language,
            "advisory": advisory,
            "grounded_evidence":
                grounded_evidence,
            "offline": True,
            "fallback": False,
        }

    except requests.exceptions.Timeout:

        return {
            "available": False,
            "provider": "OLLAMA",
            "model": OLLAMA_MODEL,
            "language": language,
            "advisory": fallback,
            "grounded_evidence":
                grounded_evidence,
            "offline": True,
            "fallback": True,
            "error":
                "Ollama generation timed out. "
                "Deterministic CRAI advisory used.",
        }

    except requests.exceptions.ConnectionError:

        return {
            "available": False,
            "provider": "OLLAMA",
            "model": OLLAMA_MODEL,
            "language": language,
            "advisory": fallback,
            "grounded_evidence":
                grounded_evidence,
            "offline": True,
            "fallback": True,
            "error":
                "Ollama is not reachable. "
                "Deterministic CRAI advisory used.",
        }

    except Exception as exc:

        return {
            "available": False,
            "provider": "OLLAMA",
            "model": OLLAMA_MODEL,
            "language": language,
            "advisory": fallback,
            "grounded_evidence":
                grounded_evidence,
            "offline": True,
            "fallback": True,
            "error": str(exc),
        }


# ============================================================
# LOCAL TEST
# ============================================================

if __name__ == "__main__":

    print(
        json.dumps(
            check_ollama(),
            indent=2,
            ensure_ascii=False,
        )
    )
