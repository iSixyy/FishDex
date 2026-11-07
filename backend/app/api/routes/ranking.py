from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.fish_species import FishSpecies
from app.models.user import User
from app.schemas.extra import RankedValueEntry, RankingPage
from app.schemas.ranking import FriendsRanking, RankingEntry
from app.services import friend_service, ranking_service
from app.services.user_service import to_user_public

router = APIRouter(prefix="/ranking", tags=["ranking"])


def _page(entries, me_entry) -> RankingPage:
    def convert(item):
        position, user, value = item
        return RankedValueEntry(position=position, user=to_user_public(user), value=float(value or 0))

    return RankingPage(entries=[convert(e) for e in entries], me=convert(me_entry) if me_entry else None)


@router.get("/friends", response_model=FriendsRanking)
def get_friends_ranking(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> FriendsRanking:
    friends = friend_service.list_friends(db, user.id)
    participants = [user, *friends]
    participants.sort(key=lambda u: u.elo, reverse=True)
    entries = [RankingEntry(position=i + 1, user=to_user_public(u)) for i, u in enumerate(participants)]
    return FriendsRanking(entries=entries)


@router.get("/global", response_model=RankingPage)
def get_global_ranking(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RankingPage:
    return _page(*ranking_service.global_ranking(db, user, limit, offset))


@router.get("/regions", response_model=list[str])
def list_regions(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[str]:
    return ranking_service.list_regions(db)


@router.get("/region/{community}", response_model=RankingPage)
def get_region_ranking(
    community: str,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RankingPage:
    """ELO conseguido con capturas en esa comunidad autónoma."""
    return _page(*ranking_service.region_ranking(db, community, user, limit, offset))


@router.get("/species/{species_id}", response_model=RankingPage)
def get_species_ranking(
    species_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RankingPage:
    """Récord de peso (kg) de cada usuario en esa especie."""
    if db.query(FishSpecies).filter(FishSpecies.id == species_id).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Especie no encontrada")
    return _page(*ranking_service.species_ranking(db, species_id, user, limit, offset))
