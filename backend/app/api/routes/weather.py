from fastapi import APIRouter, Depends, HTTPException, Query, status
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.models.user import User
from app.services import weather_service

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("")
async def get_weather(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    user: User = Depends(get_current_user),
) -> dict:
    """Viento, presión, temperaturas, oleaje, mareas y fase lunar en un punto."""
    conditions = await run_in_threadpool(weather_service.get_conditions, latitude, longitude)
    if conditions is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "El servicio de clima no está disponible ahora mismo")
    return conditions
