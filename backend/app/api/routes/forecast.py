from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import forecast_service, spot_service, weather_service

router = APIRouter(tags=["forecast"])


@router.get("/forecast")
async def get_forecast(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    user: User = Depends(get_current_user),
) -> dict:
    """Previsión de picada (0-100) para un punto, con los factores que suman
    o restan. Nunca falla: sin datos de clima usa solo la hora y la luna."""
    conditions = await run_in_threadpool(weather_service.get_conditions, latitude, longitude)
    return forecast_service.bite_forecast(conditions)


@router.get("/spots/{spot_id}/forecast")
async def get_spot_forecast(spot_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    spot = spot_service.get_visible_spot_or_404(db, user, spot_id)
    conditions = await run_in_threadpool(weather_service.get_conditions, spot.latitude, spot.longitude)
    return forecast_service.bite_forecast(conditions)
