"""Integración con Ollama (IA local, gratuita).

La aplicación NUNCA depende de que Ollama esté disponible: cualquier
llamada que falle o exceda el timeout devuelve `None` y el llamador debe
usar el sistema local de frases/datos predefinidos como fallback (o, en la
identificación por foto, dejar que el usuario rellene los datos a mano).

Cambiar de modelo o de motor de IA en el futuro solo implica tocar esta
clase (o sustituirla por otra que cumpla la misma interfaz).
"""
import base64
import json
import time
from dataclasses import dataclass

import httpx

from app.config import get_settings

AVAILABILITY_CACHE_TTL_SECONDS = 30

_IDENTIFY_PROMPT = (
    "Eres un ictiólogo experto en la pesca deportiva en España. Mira la foto e "
    "identifica el pez principal. Responde SOLO con un objeto JSON con estas claves:\n"
    '  "is_fish": true/false (false si en la foto no hay ningún pez),\n'
    '  "common_name_es": nombre común en español de España,\n'
    '  "scientific_name": nombre científico binomial,\n'
    '  "confidence": número 0-1 con tu seguridad en la identificación,\n'
    '  "estimated_weight_kg": peso estimado del ejemplar de la foto,\n'
    '  "estimated_length_cm": longitud estimada del ejemplar de la foto,\n'
    '  "water_type": "FRESH", "SALT" o "BRACKISH",\n'
    '  "habitat": hábitat típico (máximo 8 palabras),\n'
    '  "region": zonas típicas de España donde se pesca (máximo 8 palabras),\n'
    '  "catch_difficulty": entero 1-10, lo difícil que es pescar esta especie en '
    "España (1 = se pesca en cualquier puerto, 10 = casi imposible),\n"
    '  "typical_max_weight_kg": peso máximo habitual de la especie,\n'
    '  "typical_max_length_cm": longitud máxima habitual de la especie,\n'
    '  "description": 1-2 frases describiendo la especie,\n'
    '  "fun_fact": un dato curioso breve.\n'
    "Usa estimaciones razonables basadas en proporciones visibles (manos, caña, "
    "suelo). No añadas texto fuera del JSON."
)


@dataclass
class FishIdentification:
    """Resultado ya validado y acotado de la IA (nunca valores absurdos)."""

    common_name: str
    scientific_name: str
    confidence: float
    estimated_weight_kg: float | None
    estimated_length_cm: float | None
    water_type: str
    habitat: str
    region: str
    catch_difficulty: int
    typical_max_weight_kg: float | None
    typical_max_length_cm: float | None
    description: str
    fun_fact: str


def _num(value, low: float, high: float) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number <= low or number > high:  # NaN o fuera de rango
        return None
    return round(number, 2)


def _text(value, max_length: int) -> str:
    return str(value or "").strip().strip('"')[:max_length]


def parse_identification(data: dict) -> FishIdentification | None:
    """Valida el JSON devuelto por el modelo. Separado de la llamada HTTP para
    poder probarlo sin Ollama."""
    if not isinstance(data, dict) or data.get("is_fish") is False:
        return None
    common_name = _text(data.get("common_name_es"), 80)
    scientific_name = " ".join(_text(data.get("scientific_name"), 120).split())
    if not common_name or not scientific_name:
        return None
    confidence = _num(data.get("confidence"), -0.01, 1) or 0.0
    water_type = str(data.get("water_type") or "").upper()
    if water_type not in ("FRESH", "SALT", "BRACKISH"):
        water_type = "SALT"
    try:
        difficulty = min(max(int(round(float(data.get("catch_difficulty")))), 1), 10)
    except (TypeError, ValueError):
        difficulty = 5
    return FishIdentification(
        common_name=common_name[:1].upper() + common_name[1:],
        scientific_name=scientific_name[:1].upper() + scientific_name[1:].lower(),
        confidence=confidence,
        estimated_weight_kg=_num(data.get("estimated_weight_kg"), 0, 500),
        estimated_length_cm=_num(data.get("estimated_length_cm"), 0, 1000),
        water_type=water_type,
        habitat=_text(data.get("habitat"), 120) or "Información no disponible",
        region=_text(data.get("region"), 120) or "Información no disponible",
        catch_difficulty=difficulty,
        typical_max_weight_kg=_num(data.get("typical_max_weight_kg"), 0, 1000),
        typical_max_length_cm=_num(data.get("typical_max_length_cm"), 0, 1500),
        description=_text(data.get("description"), 600) or "Especie identificada por la IA de FishDex.",
        fun_fact=_text(data.get("fun_fact"), 400) or "Todavía no hay curiosidades de esta especie.",
    )


class AIService:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._tags_cache: list[str] | None = None
        self._checked_at: float = 0.0

    @property
    def enabled(self) -> bool:
        return self._settings.ollama_enabled

    def _model_tags(self) -> list[str] | None:
        """Modelos instalados en Ollama (None si no responde). Cacheado
        `AVAILABILITY_CACHE_TTL_SECONDS` para no bloquear cada petición."""
        now = time.monotonic()
        if self._checked_at and (now - self._checked_at) < AVAILABILITY_CACHE_TTL_SECONDS:
            return self._tags_cache
        try:
            with httpx.Client(timeout=2.0) as client:
                response = client.get(f"{self._settings.ollama_host}/api/tags")
            if response.status_code == 200:
                self._tags_cache = [m.get("name", "") for m in response.json().get("models", [])]
            else:
                self._tags_cache = None
        except (httpx.HTTPError, ValueError):
            self._tags_cache = None
        self._checked_at = now
        return self._tags_cache

    def is_available(self) -> bool:
        return self.enabled and self._model_tags() is not None

    def is_vision_available(self) -> bool:
        """True si Ollama responde Y tiene descargado el modelo de visión."""
        if not self.enabled:
            return False
        tags = self._model_tags()
        if tags is None:
            return False
        wanted = self._settings.ollama_vision_model
        return any(tag == wanted or tag.split(":")[0] == wanted.split(":")[0] for tag in tags)

    def generate_text(self, prompt: str, system: str | None = None) -> str | None:
        """Genera texto con el modelo configurado. Devuelve None si
        Ollama no está disponible o la petición falla/excede el timeout."""
        if not self.enabled:
            return None
        try:
            payload = {
                "model": self._settings.ollama_model,
                "prompt": prompt,
                "stream": False,
            }
            if system:
                payload["system"] = system
            with httpx.Client(timeout=self._settings.ollama_timeout_seconds) as client:
                response = client.post(f"{self._settings.ollama_host}/api/generate", json=payload)
                response.raise_for_status()
                data = response.json()
                text = data.get("response", "").strip()
                return text or None
        except (httpx.HTTPError, ValueError):
            return None

    def identify_fish(self, image_bytes: bytes) -> FishIdentification | None:
        """Identifica el pez de una foto con el modelo de visión. Devuelve
        None si no hay IA, no es un pez o la respuesta no es válida."""
        if not self.enabled:
            return None
        payload = {
            "model": self._settings.ollama_vision_model,
            "prompt": _IDENTIFY_PROMPT,
            "images": [base64.b64encode(image_bytes).decode("ascii")],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.1},
        }
        try:
            with httpx.Client(timeout=self._settings.ollama_vision_timeout_seconds) as client:
                response = client.post(f"{self._settings.ollama_host}/api/generate", json=payload)
                response.raise_for_status()
                raw = response.json().get("response", "")
            return parse_identification(json.loads(raw))
        except (httpx.HTTPError, ValueError, TypeError):
            return None


ai_service = AIService()
