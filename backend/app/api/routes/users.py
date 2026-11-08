from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.game_config import GAME_TIMEZONE
from app.database import get_db
from app.models.user import User
from app.schemas.common import AchievementPublic
from app.schemas.extra import ShowcaseUpdate
from app.schemas.account import AccountDelete, LicensePublic, LicenseUpdate, ProfileUpdate
from app.schemas.user import UserProfile
from app.services import account_service, achievement_service, friend_service
from app.services.capture_service import read_capture_image
from app.services.user_service import build_user_profile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
def get_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UserProfile:
    return build_user_profile(db, user)


@router.patch("/me", response_model=UserProfile)
def update_me(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UserProfile:
    """Edita el perfil (de momento, el nombre visible)."""
    return build_user_profile(db, account_service.update_profile(db, user, display_name=payload.display_name))


@router.post("/me/avatar", response_model=UserProfile)
async def upload_avatar(
    image: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> UserProfile:
    """Sube una foto de perfil (se recorta al cuadrado central)."""
    raw = await read_capture_image(image)
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La imagen está vacía")
    updated = await run_in_threadpool(account_service.set_avatar, db, user, raw)
    return build_user_profile(db, updated)


@router.delete("/me/avatar", response_model=UserProfile)
def delete_avatar(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UserProfile:
    return build_user_profile(db, account_service.remove_avatar(db, user))


@router.delete("/me", status_code=204)
def delete_me(payload: AccountDelete, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Borra la cuenta y TODOS sus datos (capturas, fotos, amistades,
    comentarios, spots...). Pide la contraseña para confirmar."""
    account_service.delete_account(db, user, payload.password)


def _license_public(user: User) -> LicensePublic:
    days_left = None
    if user.license_expires_on is not None:
        today = datetime.now(ZoneInfo(GAME_TIMEZONE)).date()
        days_left = (user.license_expires_on - today).days
    return LicensePublic(expires_on=user.license_expires_on, region=user.license_region, days_left=days_left)


@router.get("/me/license", response_model=LicensePublic)
def get_license(user: User = Depends(get_current_user)) -> LicensePublic:
    return _license_public(user)


@router.put("/me/license", response_model=LicensePublic)
def put_license(payload: LicenseUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> LicensePublic:
    """Guarda la caducidad de la licencia de pesca: se avisa por push a 30 y
    a 7 días, y el día que caduca. `expires_on: null` la borra."""
    return _license_public(account_service.set_license(db, user, expires_on=payload.expires_on, region=payload.region))


@router.put("/me/showcase", response_model=UserProfile)
def update_showcase(
    payload: ShowcaseUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> UserProfile:
    """Elige hasta 3 insignias desbloqueadas para la vitrina del perfil
    (lista vacía = automática: las de mayor nivel)."""
    codes = achievement_service.validate_showcase_codes(db, user.id, payload.codes)
    user.featured_badges = ",".join(codes) or None
    db.commit()
    db.refresh(user)
    return build_user_profile(db, user)


@router.get("/{user_id}", response_model=UserProfile)
def get_user(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UserProfile:
    # Se comprueba la amistad ANTES de la existencia (mismo criterio que /friends/{user_id}/fishdex)
    # para no permitir enumerar usuarios por diferencia entre 403 y 404.
    friend_service.assert_friendship_or_self(db, user, user_id)
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return build_user_profile(db, target)


@router.get("/{user_id}/achievements", response_model=list[AchievementPublic])
def get_user_achievements(
    user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[AchievementPublic]:
    """Vitrina completa de insignias de un amigo (o la propia)."""
    friend_service.assert_friendship_or_self(db, user, user_id)
    return [achievement_service.to_public(a, at) for a, at in achievement_service.list_user_achievements(db, user_id)]
