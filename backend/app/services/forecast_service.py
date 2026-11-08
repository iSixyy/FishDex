"""Previsión de picada: «¿es buen momento para pescar aquí?».

Puntuación orientativa de 0 a 100 a partir de lo que ya da `weather_service`
(presión, viento, nubosidad, tiempo, mareas y luna) y de la hora local. Son
reglas conocidas entre pescadores, no una ciencia exacta: la app la presenta
como orientación y explica cada factor que suma o resta.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.core.game_config import GAME_TIMEZONE
from app.services.weather_service import moon_phase

_TZ = ZoneInfo(GAME_TIMEZONE)
BASE_SCORE = 50


def _factor(label: str, points: int, detail: str) -> dict:
    return {"label": label, "points": points, "impact": "up" if points > 0 else "down" if points < 0 else "neutral", "detail": detail}


def _label(score: int) -> str:
    if score >= 75:
        return "Excelente"
    if score >= 60:
        return "Buena"
    if score >= 40:
        return "Regular"
    return "Mala"


def bite_forecast(conditions: dict | None, now: datetime | None = None) -> dict:
    """Calcula la previsión. Funciona aunque falte el clima (solo hora y
    luna); en ese caso `partial` es True."""
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(_TZ)
    conditions = conditions or {}
    factors: list[dict] = []

    # Hora del día: amanecer y atardecer son los momentos clásicos de picada.
    hour = local.hour
    if 6 <= hour < 10 or 17 <= hour < 21:
        factors.append(_factor("Hora", 10, "Amanecer o atardecer: los peces se acercan a comer."))
    elif 12 <= hour < 17:
        factors.append(_factor("Hora", -5, "Horas centrales del día: más luz y calor, menos actividad."))
    elif hour >= 22 or hour < 5:
        factors.append(_factor("Hora", 0, "Noche: buena para algunas especies (congrio, lubina), floja para otras."))

    # Luna: con luna nueva o llena hay mareas vivas y más movimiento de agua.
    moon = conditions.get("moon") or moon_phase(now)
    illumination = moon.get("illumination", 0.5)
    if illumination >= 0.9 or illumination <= 0.1:
        factors.append(_factor("Luna", 10, f"{moon.get('name', 'Luna')}: mareas vivas, más movimiento de agua."))
    elif 0.4 <= illumination <= 0.6:
        factors.append(_factor("Luna", -5, f"{moon.get('name', 'Luna')}: mareas muertas, poco movimiento."))

    pressure = conditions.get("pressure_hpa")
    if pressure is not None:
        if 1010 <= pressure <= 1022:
            factors.append(_factor("Presión", 10, f"{pressure:.0f} hPa: estable, buena para pescar."))
        elif pressure < 1000:
            factors.append(_factor("Presión", -10, f"{pressure:.0f} hPa: borrasca, los peces se aletargan."))
        elif pressure > 1030:
            factors.append(_factor("Presión", -5, f"{pressure:.0f} hPa: anticiclón fuerte, agua muy parada."))

    wind = conditions.get("wind_speed_kmh")
    if wind is not None:
        if wind < 10:
            factors.append(_factor("Viento", 10, f"{wind:.0f} km/h: calma, se lanza y se nota la picada."))
        elif wind < 20:
            factors.append(_factor("Viento", 5, f"{wind:.0f} km/h: brisa que oxigena el agua."))
        elif wind < 30:
            factors.append(_factor("Viento", -5, f"{wind:.0f} km/h: incómodo para lanzar."))
        else:
            factors.append(_factor("Viento", -15, f"{wind:.0f} km/h: demasiado viento, cuidado."))

    clouds = conditions.get("cloud_cover_pct")
    if clouds is not None and 30 <= clouds <= 80:
        factors.append(_factor("Nubes", 5, f"{clouds:.0f} % de nubes: luz suave, el pez desconfía menos."))

    summary = conditions.get("summary")
    if summary == "Tormenta":
        factors.append(_factor("Tiempo", -25, "Tormenta: no salgas a pescar."))
    elif summary == "Llovizna":
        factors.append(_factor("Tiempo", 5, "Llovizna: remueve el agua y activa la comida."))

    # Mareas: la hora antes y después de la pleamar/bajamar es la más activa.
    upcoming = []
    for tide in conditions.get("tides") or []:
        try:
            moment = datetime.fromisoformat(tide["time"].replace("Z", "+00:00"))
        except (KeyError, ValueError, AttributeError):
            continue
        hours = (moment - now).total_seconds() / 3600
        if hours >= -1:
            upcoming.append((hours, tide.get("type")))
    if upcoming:
        hours, kind = min(upcoming)
        name = "pleamar" if kind == "HIGH" else "bajamar"
        if hours <= 2:
            factors.append(_factor("Marea", 15, f"Cambio de marea ({name}) {'ahora' if hours < 0.5 else f'en {hours:.0f} h'}: momento clave."))
        else:
            factors.append(_factor("Marea", 0, f"Próxima {name} en {hours:.0f} h."))

    score = max(0, min(100, BASE_SCORE + sum(f["points"] for f in factors)))
    best = max((f for f in factors if f["points"] > 0), key=lambda f: f["points"], default=None)
    return {
        "score": score,
        "label": _label(score),
        "summary": best["detail"] if best else "Sin factores destacables: día normal de pesca.",
        "factors": factors,
        "partial": not conditions or "pressure_hpa" not in conditions,
        "computed_at": now.isoformat(),
    }
