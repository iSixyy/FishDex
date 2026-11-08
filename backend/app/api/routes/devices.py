from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.user import User
from app.schemas.extra import DeviceRegister, DeviceUnregister
from app.services import notification_service
from starlette.requests import Request

router = APIRouter(prefix="/devices", tags=["notifications"])


@router.post("", status_code=204)
def register_device(payload: DeviceRegister, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    notification_service.register_device(db, user.id, payload.token, payload.platform)


@router.post("/unregister", status_code=204)
@limiter.limit("30/minute")
def unregister_device(request: Request, payload: DeviceUnregister, db: Session = Depends(get_db)) -> None:
    """Da de baja un token push SIN exigir sesión: cuando el móvil cierra la
    sesión porque el token JWT ha caducado (401) ya no puede autenticarse, y
    antes el dispositivo seguía recibiendo los avisos de esa cuenta. Tener el
    token de Expo (secreto del propio dispositivo) basta para darlo de baja."""
    notification_service.unregister_device(db, payload.token)
