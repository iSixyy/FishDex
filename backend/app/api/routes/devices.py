from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.extra import DeviceRegister
from app.services import notification_service

router = APIRouter(prefix="/devices", tags=["notifications"])


@router.post("", status_code=204)
def register_device(payload: DeviceRegister, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    notification_service.register_device(db, user.id, payload.token, payload.platform)


@router.post("/unregister", status_code=204)
def unregister_device(payload: DeviceRegister, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    notification_service.unregister_device(db, user.id, payload.token)
