from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.common import AchievementPublic
from app.services import achievement_service

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=list[AchievementPublic])
def list_achievements(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[AchievementPublic]:
    return [achievement_service.to_public(a, at) for a, at in achievement_service.list_user_achievements(db, user.id)]
