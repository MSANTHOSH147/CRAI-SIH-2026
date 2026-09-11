"""
CRAI LOCAL LLM SERVICE
======================

Grounded offline advisory layer for CRAI.

Architecture:
Disease AI -> Evidence Engine -> Fusion Risk -> Decision Engine
-> structured CRAI evidence -> Qwen3/Ollama -> farmer advisory

Qwen3 NEVER calculates or changes CRAI risk/decision.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

import requests


OLLAMA_BASE_URL = os.getenv("CRAI_OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_URL = os.getenv("CRAI_OLLAMA_URL", f"{OLLAMA_BASE_URL}/api/generate")
OLLAMA_MODEL = os.getenv("CRAI_OLLAMA_MODEL", "qwen3:1.7b")

# CPU inference can be slow. Keep the request bounded and allow override.
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("CRAI_OLLAMA_TIMEOUT", "90"))
MAX_OUTPUT_TOKENS = int(os.getenv("CRAI_OLLAMA_MAX_TOKENS", "180"))
KEEP_ALIVE = os.getenv("CRAI_OLLAMA_KEEP_ALIVE", "10m")

SYSTEM_PROMPT = """
You are CRAI's local agricultural advisory layer.

CRAI has already calculated the field evidence, risk score, risk level,
assessment confidence, decision, and recommended steps.

You are NOT the risk engine.

STRICT RULES:
1. Never calculate or modify the CRAI field risk.
2. Never change the supplied risk level or decision.
3. Never invent sensor values, weather, disease facts, observations,
   treatments, doses, chemicals, or application rates.
4. Treat disease_signal as a visual/model signal, NOT laboratory confirmation.
5. Use only the supplied JSON evidence.
6. Preserve supplied numeric values exactly when mentioning them.
7. Do not describe a measurement as normal/safe unless the evidence explicitly
   says that.
8. Follow the supplied recommended_steps rather than inventing new treatment.
9. If evidence is incomplete or uncertainty is not LOW, say so.
10. Keep the answer short and farmer-friendly.

Return exactly these headings:
Situation:
Why:
What to do now:
Next check:
Caution:

Do not add other headings.
"""

SUPPORTED_LANGUAGES = {
    "en": "English", "english": "English",
    "ta": "Tamil", "tamil": "Tamil",
    "hi": "Hindi", "hindi": "Hindi",
    "te": "Telugu", "telugu": "Telugu",
    "kn": "Kannada", "kannada": "Kannada",
    "ml": "Malayalam", "malayalam": "Malayalam",
    "mr": "Marathi", "marathi": "Marathi",
    "bn": "Bengali", "bengali": "Bengali",
    "gu": "Gujarati", "gujarati": "Gujarati",
    "pa": "Punjabi", "punjabi": "Punjabi",
}


def normalize_language(language: Optional[str]) -> str:
    if not language:
        return "English"
    return SUPPORTED_LANGUAGES.get(str(language).strip().lower(), "English")


def _clean_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _clean_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean_value(v) for v in value]
    return str(value)


def _first(data: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return None


def build_grounded_evidence(field_data: Dict[str, Any]) -> Dict[str, Any]:
    data = field_data if isinstance(field_data, dict) else {}

    # Preserve authoritative nested decision/risk objects when callers pass
    # the complete CRAI analysis response.
    risk = data.get("risk") if isinstance(data.get("risk"), dict) else {}
    decision_obj = data.get("decision") if isinstance(data.get("decision"), dict) else {}
    context = decision_obj.get("context") if isinstance(decision_obj.get("context"), dict) else {}

    evidence = {
        "crop": _first(data, "crop"),
        "growth_stage": _first(data, "growth_stage"),
        "zone": _first(data, "zone", "zone_id", "zoneId", "field_zone"),

        "disease_signal": _first(
            data, "disease_signal", "prediction",
            "disease"
        ),
        "model_confidence": _first(
            data, "model_confidence", "confidence",
            "disease_confidence"
        ),

        "field_risk": _first(
            data, "field_risk", "risk_score"
        ),
        "risk_level": _first(data, "risk_level") or risk.get("risk_level"),
        "assessment_confidence": (
            _first(data, "assessment_confidence")
            or risk.get("assessment_confidence")
        ),

        "soil_moisture": _first(data, "soil_moisture"),
        "temperature": _first(data, "temperature"),
        "humidity": _first(data, "humidity"),

        "spatial_signal": _first(data, "spatial_signal"),
        "temporal_trend": _first(data, "temporal_trend"),

        "decision": _first(data, "decision", "action")
            if not isinstance(data.get("decision"), dict)
            else decision_obj.get("action"),

        "recommended_steps": _first(data, "recommended_steps"),
        "evidence_quality": _first(data, "evidence_quality"),
        "uncertainty": _first(data, "uncertainty"),
    }

    # Pull authoritative values from decision.context if the caller supplied
    # the complete decision response.
    if context:
        aliases = {
            "field_risk": ("risk_score",),
            "risk_level": ("risk_level",),
            "assessment_confidence": ("assessment_confidence",),
            "disease_signal": ("disease",),
            "model_confidence": ("disease_confidence",),
            "soil_moisture": ("soil_moisture",),
            "temperature": ("temperature",),
            "humidity": ("humidity",),
            "spatial_signal": (),
            "temporal_trend": ("temporal_trend",),
            "evidence_quality": ("evidence_quality",),
            "uncertainty": ("uncertainty",),
        }
        for target, source_keys in aliases.items():
            if evidence.get(target) is None:
                for source_key in source_keys:
                    if context.get(source_key) is not None:
                        evidence[target] = context[source_key]
                        break

        if evidence.get("spatial_signal") is None:
            infected = context.get("infected_observed_zones")
            total = context.get("total_observed_zones")
            if infected is not None and total is not None:
                evidence["spatial_signal"] = f"{infected} of {total} observed zones affected"

    # If decision is a complete object, use its recommended steps.
    if not evidence.get("recommended_steps"):
        steps = decision_obj.get("recommended_steps")
        if isinstance(steps, list):
            evidence["recommended_steps"] = steps

    # Drop nothing: explicit nulls are useful because they prevent the LLM
    # from assuming missing values are zero.
    return evidence


def build_advisory_prompt(
    field_data: Dict[str, Any],
    language: str = "English",
) -> str:
    evidence = build_grounded_evidence(field_data)
    payload = json.dumps(_clean_value(evidence), ensure_ascii=False, indent=2)

    return f"""
Generate a concise farmer advisory in {language}.

Use ONLY this CRAI evidence JSON.

The values in the JSON are authoritative.
Do not infer missing values.
Do not call a low measurement normal unless CRAI explicitly says so.
The disease signal is a model/visual signal, not laboratory confirmation.

CRAI EVIDENCE:
{payload}

Return exactly:
Situation:
Why:
What to do now:
Next check:
Caution:
"""


def _deterministic_fallback(evidence: Dict[str, Any], language: str, error: str) -> Dict[str, Any]:
    # Safe fallback: no new agronomic facts are introduced.
    disease = evidence.get("disease_signal") or "a crop issue"
    confidence = evidence.get("model_confidence")
    risk = evidence.get("field_risk")
    risk_level = evidence.get("risk_level") or "UNKNOWN"
    decision = evidence.get("decision") or "FOLLOW_CRAI_RECOMMENDATION"
    steps = evidence.get("recommended_steps") or ["Re-observe the affected zone."]

    confidence_text = f"{confidence}%" if confidence is not None else "not available"
    risk_text = f"{risk}" if risk is not None else "not available"
    steps_text = " ".join(str(x) for x in steps[:4])

    advisory = (
        f"Situation:\nA visual/model signal for {disease} was detected "
        f"with model confidence {confidence_text}.\n\n"
        f"Why:\nCRAI field risk is {risk_text} ({risk_level}). "
        f"The CRAI decision is {decision}.\n\n"
        f"What to do now:\n{steps_text}\n\n"
        f"Next check:\nRe-observe the zone after the recommended inspection/action.\n\n"
        f"Caution:\nThis is a model-based field signal, not laboratory confirmation. "
        f"Use the CRAI evidence and decision as provided."
    )

    return {
        "available": False,
        "provider": "OLLAMA",
        "model": OLLAMA_MODEL,
        "language": language,
        "advisory": advisory,
        "grounded_evidence": evidence,
        "offline": True,
        "fallback": True,
        "error": error,
    }


def check_ollama(timeout: float = 3.0) -> Dict[str, Any]:
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=timeout)
        if response.status_code != 200:
            return {"available": False, "error": f"Ollama returned HTTP {response.status_code}"}

        data = response.json()
        models = [item.get("name") for item in data.get("models", [])]
        return {
            "available": True,
            "model": OLLAMA_MODEL,
            "model_available": OLLAMA_MODEL in models,
            "models": models,
        }
    except requests.RequestException as exc:
        return {"available": False, "model": OLLAMA_MODEL, "error": str(exc)}


def generate_local_advisory(
    field_data: Dict[str, Any],
    language: str = "English",
) -> Dict[str, Any]:
    language = normalize_language(language)
    evidence = build_grounded_evidence(field_data)
    prompt = build_advisory_prompt(field_data, language)

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": SYSTEM_PROMPT,
        "stream": False,
        "think": False,
        "keep_alive": KEEP_ALIVE,
        "options": {
            "temperature": 0.1,
            "top_p": 0.7,
            "num_predict": MAX_OUTPUT_TOKENS,
        },
    }

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=OLLAMA_TIMEOUT_SECONDS,
        )

        if response.status_code != 200:
            return _deterministic_fallback(
                evidence, language,
                f"Ollama HTTP {response.status_code}: {response.text[:300]}"
            )

        data = response.json()
        advisory = data.get("response")

        if not advisory and isinstance(data.get("message"), dict):
            advisory = data["message"].get("content")

        if not advisory or not str(advisory).strip():
            return _deterministic_fallback(
                evidence, language, "Ollama returned an empty advisory."
            )

        return {
            "available": True,
            "provider": "OLLAMA",
            "model": OLLAMA_MODEL,
            "language": language,
            "advisory": str(advisory).strip(),
            "grounded_evidence": evidence,
            "offline": True,
            "fallback": False,
        }

    except requests.Timeout:
        return _deterministic_fallback(
            evidence, language,
            f"Ollama timed out after {OLLAMA_TIMEOUT_SECONDS:g} seconds."
        )
    except requests.RequestException as exc:
        return _deterministic_fallback(evidence, language, str(exc))
    except Exception as exc:
        return _deterministic_fallback(evidence, language, str(exc))


if __name__ == "__main__":
    sample = {
        "crop": "Tomato",
        "growth_stage": "Vegetative",
        "zone": "A1",
        "disease_signal": "Tomato_Late_Blight",
        "model_confidence": 89.18,
        "field_risk": 70.9,
        "risk_level": "CRITICAL",
        "assessment_confidence": "HIGH",
        "soil_moisture": 22.8,
        "temperature": 34.5,
        "humidity": 78.2,
        "spatial_signal": "2 of 2 observed zones affected",
        "temporal_trend": "DECREASING",
        "decision": "PRIORITIZE_INSPECTION",
        "recommended_steps": [
            "Inspect symptomatic plants",
            "Check irrigation requirements at 22.8% soil moisture",
            "Re-observe the zone after intervention",
        ],
        "evidence_quality": "HIGH",
        "uncertainty": "LOW",
    }
    print(json.dumps(generate_local_advisory(sample), indent=2, ensure_ascii=False))
