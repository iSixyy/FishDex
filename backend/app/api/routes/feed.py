from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.feed import FeedEntry
from app.services import feed_service

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=list[FeedEntry])
def get_feed(
    scope: str = Query(default="highlights", pattern="^(friends|highlights)$"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FeedEntry]:
    return feed_service.get_feed(db, user, scope, limit, offset)
