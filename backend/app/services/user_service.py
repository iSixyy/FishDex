from sqlalchemy.orm import Session

from app.core.game_config import Rarity, get_rank_for_elo
from app.models.capture import Capture
from app.models.fish_species import FishSpecies
from app.models.user import User
from app.schemas.user import RankInfo, UserPublic, UserProfile, UserStats


def to_user_public(user: User) -> UserPublic:
    rank = get_rank_for_elo(user.elo)
    return UserPublic(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar=user.avatar,
        elo=user.elo,
        rank=RankInfo(**{k: rank[k] for k in ("key", "name", "icon", "min_elo", "max_elo", "description")}),
        created_at=user.created_at,
        is_admin=user.is_admin,
    )


_RARITY_ORDER = [Rarity.MYTHIC, Rarity.LEGENDARY, Rarity.EPIC, Rarity.RARE, Rarity.UNCOMMON, Rarity.COMMON]


def build_user_stats(db: Session, user_id: int) -> UserStats:
    total_captures = db.query(Capture).filter(Capture.user_id == user_id).count()
    species_discovered = db.query(Capture.fish_species_id).filter(Capture.user_id == user_id).distinct().count()
    total_species = db.query(FishSpecies).count()

    rare_plus_values = [Rarity.RARE.value, Rarity.EPIC.value, Rarity.LEGENDARY.value, Rarity.MYTHIC.value]
    rare_plus = (
        db.query(Capture.fish_species_id)
        .join(FishSpecies, FishSpecies.id == Capture.fish_species_id)
        .filter(Capture.user_id == user_id, FishSpecies.rarity.in_(rare_plus_values))
        .distinct()
        .count()
    )

    rarest_species_name = None
    for rarity in _RARITY_ORDER:
        match = (
            db.query(FishSpecies.name)
            .join(Capture, Capture.fish_species_id == FishSpecies.id)
            .filter(Capture.user_id == user_id, FishSpecies.rarity == rarity.value)
            .first()
        )
        if match:
            rarest_species_name = match[0]
            break

    biggest = (
        db.query(Capture.weight_kg, FishSpecies.name)
        .join(FishSpecies, FishSpecies.id == Capture.fish_species_id)
        .filter(Capture.user_id == user_id)
        .order_by(Capture.weight_kg.desc())
        .first()
    )

    return UserStats(
        total_captures=total_captures,
        species_discovered=species_discovered,
        total_species=total_species,
        rare_plus_species=rare_plus,
        rarest_species_name=rarest_species_name,
        biggest_catch_weight_kg=biggest[0] if biggest else None,
        biggest_catch_species_name=biggest[1] if biggest else None,
    )


def build_user_profile(db: Session, user: User) -> UserProfile:
    from app.services import achievement_service

    showcase = [
        achievement_service.to_public(a, at)
        for a, at in achievement_service.showcase(db, user.id, user.featured_badges)
    ]
    return UserProfile(user=to_user_public(user), stats=build_user_stats(db, user.id), showcase=showcase)
