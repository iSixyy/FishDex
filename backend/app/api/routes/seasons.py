from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.extra import RankedValueEntry, SeasonPage
from app.schemas.season import SeasonReward
from app.services import season_service
from app.services.user_service import to_user_public

router = APIRouter(prefix="/seasons", tags=["seasons"])


@router.get("/current", response_model=SeasonPage)
def current_season(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SeasonPage:
    """Ranking de la temporada en curso: solo cuenta el ELO de las capturas
    pescadas este trimestre, así que cada 3 meses todos empiezan de cero."""
    season = season_service.season_for()
    entries, me = season_service.season_ranking(db, season, user, limit, offset)

    def convert(item):
        position, entry_user, value = item
        return RankedValueEntry(position=position, user=to_user_public(entry_user), value=float(value or 0))

    return SeasonPage(
        key=season.key,
        name=season.name,
        starts_at=season.starts_at,
        ends_at=season.ends_at,
        entries=[convert(e) for e in entries],
        me=convert(me) if me else None,
        rewards=[
            SeasonReward(tier=tier, label=season_service.TIER_LABELS[tier], positions=positions)
            for tier, positions in season_service.REWARDS
        ],
    )
