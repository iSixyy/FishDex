from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.game_config import Rarity
from app.database import get_db
from app.models.fish_species import FishSpecies
from app.models.user import User
from app.schemas.friend import (
    ComparisonEntry,
    FriendComparison,
    FriendFishDex,
    FriendPublic,
    FriendRequestCreate,
    FriendRequestPublic,
)
from app.services import friend_service
from app.services.fishdex_service import build_fishdex_progress
from app.services.user_service import to_user_public

router = APIRouter(prefix="/friends", tags=["friends"])

LEGENDARY_PLUS = {Rarity.LEGENDARY, Rarity.MYTHIC}


@router.post("/request", response_model=FriendRequestPublic, status_code=201)
def request_friend(
    payload: FriendRequestCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> FriendRequestPublic:
    request = friend_service.send_friend_request(db, user, payload.to_username)
    return FriendRequestPublic(
        id=request.id,
        from_user=to_user_public(request.from_user),
        to_user=to_user_public(request.to_user),
        status=request.status,
        created_at=request.created_at,
    )


@router.get("/requests", response_model=list[FriendRequestPublic])
def get_pending_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[FriendRequestPublic]:
    requests = friend_service.list_pending_requests(db, user.id)
    return [
        FriendRequestPublic(
            id=r.id, from_user=to_user_public(r.from_user), to_user=to_user_public(r.to_user),
            status=r.status, created_at=r.created_at,
        )
        for r in requests
    ]


@router.post("/accept/{request_id}", status_code=204)
def accept_request(request_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    friend_service.accept_friend_request(db, user, request_id)


@router.post("/reject/{request_id}", status_code=204)
def reject_request(request_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    friend_service.reject_friend_request(db, user, request_id)


@router.delete("/{friend_user_id}", status_code=204)
def delete_friend(friend_user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    friend_service.remove_friend(db, user, friend_user_id)


@router.get("", response_model=list[FriendPublic])
def get_friends(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[FriendPublic]:
    # Evita el N+1: en vez de 2 consultas por amigo (y de construir el
    # FishDexProgress completo solo para leer `len(...)`), se hace 1 consulta
    # para el total de especies y 2 consultas agregadas (GROUP BY) que cubren
    # a todos los amigos de golpe.
    friends = friend_service.list_friends(db, user.id)
    total_species = db.query(FishSpecies).count()
    friend_ids = [f.id for f in friends]
    discovered_counts = friend_service.species_discovered_counts(db, friend_ids)
    rare_counts = friend_service.rare_plus_species_counts(db, friend_ids)
    return [
        FriendPublic(
            user=to_user_public(f),
            species_discovered=discovered_counts.get(f.id, 0),
            total_species=total_species,
            rare_plus_species=rare_counts.get(f.id, 0),
        )
        for f in friends
    ]


@router.get("/{user_id}/fishdex", response_model=FriendFishDex)
def get_friend_fishdex(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> FriendFishDex:
    friend_service.assert_friendship_or_self(db, user, user_id)
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return FriendFishDex(user=to_user_public(target), dex=build_fishdex_progress(db, user_id))


@router.get("/{user_id}/compare", response_model=FriendComparison)
def compare_with_friend(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> FriendComparison:
    friend_service.assert_friendship_or_self(db, user, user_id)
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    def entry(u: User) -> ComparisonEntry:
        return ComparisonEntry(
            user=to_user_public(u),
            species_discovered=friend_service.species_discovered_count(db, u.id),
            rare_plus_species=friend_service.rare_plus_species_count(db, u.id),
            legendary_plus_species=friend_service.rare_plus_species_count(db, u.id, LEGENDARY_PLUS),
        )

    return FriendComparison(me=entry(user), friend=entry(target))
