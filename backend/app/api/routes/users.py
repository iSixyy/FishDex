from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.common import AchievementPublic
from app.schemas.extra import ShowcaseUpdate
from app.schemas.user import UserProfile
from app.services import achievement_service, friend_service
from app.services.user_service import build_user_profile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
def get_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UserProfile:
    return build_user_profile(db, user)


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
