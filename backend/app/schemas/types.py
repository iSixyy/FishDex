"""Tipos reutilizables para los esquemas de salida."""
from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def _serialize_as_utc(value: datetime) -> str:
    """Serializa un datetime marcándolo explícitamente como UTC.

    `DateTime(timezone=True)` es un no-op en SQLite: los datetimes se guardan
    ya normalizados a UTC pero vuelven de la base de datos SIN `tzinfo`. Si se
    enviaran así al cliente, `new Date("2026-09-19T19:15:14")` en JavaScript
    los interpretaría como hora LOCAL del móvil, desplazando la hora mostrada
    tantas horas como el offset del usuario (1-2 h en España).
    """
    moment = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).isoformat()


#: `datetime` que siempre se serializa con offset UTC explícito (`+00:00`).
UtcDateTime = Annotated[datetime, PlainSerializer(_serialize_as_utc, return_type=str)]
