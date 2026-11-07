"""Clima, estado del mar, mareas y fase lunar para un punto de pesca.

Usa Open-Meteo (gratis, sin clave): la API de previsión para el tiempo y la
marina para oleaje, temperatura del agua y nivel del mar (del que se sacan
las próximas pleamar/bajamar). La fase lunar se calcula localmente.

Todo es "mejor esfuerzo": si Open-Meteo no responde, o el punto está en el
interior (sin datos marinos), esos campos quedan a None y la app los oculta.
"""
import math
import time
from datetime import datetime, timezone

import httpx

from app.config import get_settings

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
CACHE_TTL_SECONDS = 15 * 60

_cache: dict[tuple[float, float], tuple[float, dict]] = {}

# Luna nueva de referencia (6 ene 2000, 18:14 UTC) y mes sinódico medio.
_REFERENCE_NEW_MOON = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc)
_SYNODIC_MONTH_DAYS = 29.530588853

_MOON_PHASES = [
    (1.84566, "Luna nueva"),
    (5.53699, "Luna creciente"),
    (9.22831, "Cuarto creciente"),
    (12.91963, "Gibosa creciente"),
    (16.61096, "Luna llena"),
    (20.30228, "Gibosa menguante"),
    (23.99361, "Cuarto menguante"),
    (27.68493, "Luna menguante"),
    (_SYNODIC_MONTH_DAYS, "Luna nueva"),
]

# Códigos WMO de Open-Meteo agrupados en textos cortos en español.
_WEATHER_CODES = [
    ({0}, "Despejado"),
    ({1, 2}, "Poco nuboso"),
    ({3}, "Cubierto"),
    ({45, 48}, "Niebla"),
    ({51, 53, 55, 56, 57}, "Llovizna"),
    ({61, 63, 65, 66, 67, 80, 81, 82}, "Lluvia"),
    ({71, 73, 75, 77, 85, 86}, "Nieve"),
    ({95, 96, 99}, "Tormenta"),
]


def moon_phase(moment: datetime | None = None) -> dict:
    moment = moment or datetime.now(timezone.utc)
    age = ((moment - _REFERENCE_NEW_MOON).total_seconds() / 86400) % _SYNODIC_MONTH_DAYS
    name = next(label for limit, label in _MOON_PHASES if age < limit)
    illumination = (1 - math.cos(2 * math.pi * age / _SYNODIC_MONTH_DAYS)) / 2
    return {"name": name, "age_days": round(age, 1), "illumination": round(illumination, 2)}


def _describe(code) -> str | None:
    if code is None:
        return None
    for codes, label in _WEATHER_CODES:
        if int(code) in codes:
            return label
    return None


def _tides(times: list[str], levels: list[float | None]) -> list[dict]:
    """Pleamares y bajamares próximas: máximos/mínimos locales de la serie
    horaria de nivel del mar (incluye la marea astronómica)."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
    events: list[dict] = []
    for i in range(1, len(levels) - 1):
        prev, cur, nxt = levels[i - 1], levels[i], levels[i + 1]
        if None in (prev, cur, nxt) or times[i] < now:
            continue
        if cur > prev and cur >= nxt:
            events.append({"type": "HIGH", "time": times[i] + ":00Z", "height_m": round(cur, 2)})
        elif cur < prev and cur <= nxt:
            events.append({"type": "LOW", "time": times[i] + ":00Z", "height_m": round(cur, 2)})
        if len(events) >= 4:
            break
    return events


def _fetch(client: httpx.Client, url: str, params: dict) -> dict | None:
    try:
        response = client.get(url, params=params)
        if response.status_code != 200:
            return None
        return response.json()
    except (httpx.HTTPError, ValueError):
        return None


def get_conditions(latitude: float, longitude: float) -> dict | None:
    """Condiciones actuales en un punto, o None si el servicio está
    desactivado o no ha respondido nada útil."""
    settings = get_settings()
    if not settings.weather_enabled:
        return None
    key = (round(latitude, 2), round(longitude, 2))
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    with httpx.Client(timeout=settings.weather_timeout_seconds) as client:
        forecast = _fetch(client, FORECAST_URL, {
            "latitude": latitude, "longitude": longitude, "timezone": "UTC",
            "current": "temperature_2m,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover,weather_code",
        })
        marine = _fetch(client, MARINE_URL, {
            "latitude": latitude, "longitude": longitude, "timezone": "UTC", "forecast_days": 2,
            "current": "wave_height,sea_surface_temperature",
            "hourly": "sea_level_height_msl",
        })

    if forecast is None and marine is None:
        return None
    current = (forecast or {}).get("current", {})
    marine_current = (marine or {}).get("current", {})
    hourly = (marine or {}).get("hourly", {})
    result = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "summary": _describe(current.get("weather_code")),
        "air_temperature_c": current.get("temperature_2m"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "wind_direction_deg": current.get("wind_direction_10m"),
        "pressure_hpa": current.get("surface_pressure"),
        "cloud_cover_pct": current.get("cloud_cover"),
        "water_temperature_c": marine_current.get("sea_surface_temperature"),
        "wave_height_m": marine_current.get("wave_height"),
        "tides": _tides(hourly.get("time", []), hourly.get("sea_level_height_msl", [])),
        "moon": moon_phase(),
    }
    _cache[key] = (time.monotonic(), result)
    return result
