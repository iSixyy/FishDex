from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.game_config import GAME_TIMEZONE
from app.database import get_db
from app.models.user import User
from app.schemas.extra import RegulationCheck
from app.services import regulation_service

router = APIRouter(prefix="/regulations", tags=["regulations"])


@router.get("/check", response_model=RegulationCheck)
def check_regulation(
    species_id: int,
    length_cm: float | None = Query(default=None, gt=0, le=1000),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    on_date: date | None = Query(default=None, description="Día de la captura (AAAA-MM-DD). Por defecto, hoy."),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RegulationCheck:
    """Avisos de veda / talla mínima / cupo para una captura antes de guardarla.

    La veda depende del DÍA de la captura: se comprueba la fecha que manda el
    móvil y, si no la manda, la de hoy en hora peninsular (antes era la fecha
    UTC, que entre las 00:00 y las 01:00/02:00 en España aún es "ayer")."""
    return RegulationCheck(**regulation_service.check_capture(
        db, species_id=species_id, length_cm=length_cm, latitude=latitude, longitude=longitude,
        on_date=on_date or datetime.now(ZoneInfo(GAME_TIMEZONE)).date(),
    ))
