"""Avisos legales al registrar una captura: veda y talla mínima.

Principio del proyecto: nunca se inventa un dato legal. Solo se avisa con
lo que haya en la tabla `regulations` (con su fuente citada). Si no hay
datos para una especie o comunidad, se dice explícitamente.
"""
from datetime import date

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.regulation import Regulation, RegulationScope
from app.services.location_service import resolve_location_name


def _in_closed_season(start: str, end: str, today: date) -> bool:
    """`start`/`end` en formato "MM-DD", ambos inclusive. Si start > end la
    veda cruza el cambio de año (p.ej. 11-01 -> 03-15)."""
    current = today.strftime("%m-%d")
    if start <= end:
        return start <= current <= end
    return current >= start or current <= end


def _format_mm_dd(value: str) -> str:
    month, day = value.split("-")
    return f"{day}/{month}"


def check_capture(
    db: Session,
    *,
    species_id: int,
    length_cm: float | None,
    latitude: float | None,
    longitude: float | None,
    on_date: date,
) -> dict:
    _, community = resolve_location_name(db, latitude, longitude)
    query = db.query(Regulation).filter(Regulation.fish_species_id == species_id)
    if community:
        query = query.filter(
            or_(Regulation.scope == RegulationScope.STATE, Regulation.autonomous_community == community)
        )
    else:
        query = query.filter(Regulation.scope == RegulationScope.STATE)
    regulations = query.all()

    warnings: list[dict] = []
    for regulation in regulations:
        zone = regulation.autonomous_community or "España"
        if regulation.closed_season_start and regulation.closed_season_end:
            if _in_closed_season(regulation.closed_season_start, regulation.closed_season_end, on_date):
                warnings.append({
                    "kind": "CLOSED_SEASON",
                    "severity": "danger",
                    "message": (
                        f"Esta especie está en veda en {zone} hasta el "
                        f"{_format_mm_dd(regulation.closed_season_end)}."
                    ),
                    "source": regulation.source,
                })
        elif regulation.closed_season:
            warnings.append({
                "kind": "CLOSED_SEASON_INFO",
                "severity": "info",
                "message": f"Veda en {zone}: {regulation.closed_season}",
                "source": regulation.source,
            })
        if regulation.legal_min_length_cm is not None:
            below = length_cm is not None and length_cm < regulation.legal_min_length_cm
            size = f"{regulation.legal_min_length_cm:g}".replace(".", ",")
            warnings.append({
                "kind": "MIN_LENGTH",
                "severity": "danger" if below else "info",
                "message": (
                    f"Por debajo de la talla mínima legal en {zone} ({size} cm): devuélvela al agua."
                    if below
                    else f"Talla mínima legal en {zone}: {size} cm."
                ),
                "source": regulation.source,
            })
        if regulation.daily_catch_limit is not None:
            warnings.append({
                "kind": "DAILY_LIMIT",
                "severity": "info",
                "message": f"Cupo diario en {zone}: {regulation.daily_catch_limit} ejemplares.",
                "source": regulation.source,
            })

    return {
        "autonomous_community": community,
        "has_data": bool(regulations),
        "warnings": warnings,
    }
