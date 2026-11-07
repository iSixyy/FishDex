from fastapi import APIRouter

from app.core.game_config import RANKS, RARITY_BASE_ELO, RARITY_META
from app.schemas.common import GameConfig, RankConfigEntry, RarityConfigEntry
from app.services.ai_service import ai_service

router = APIRouter(prefix="/config", tags=["config"])


@router.get("", response_model=GameConfig)
def get_game_config() -> GameConfig:
    """Expone ELO/rangos al cliente para que la UI nunca los hardcodee."""
    rarities = [
        RarityConfigEntry(key=rarity.value, label=meta["label"], color=meta["color"], base_elo=RARITY_BASE_ELO[rarity])
        for rarity, meta in RARITY_META.items()
    ]
    ranks = [
        RankConfigEntry(
            key=r["key"], name=r["name"], icon=r["icon"],
            min_elo=r["min_elo"], max_elo=r["max_elo"], description=r["description"],
        )
        for r in RANKS
    ]
    return GameConfig(
        rarities=rarities,
        ranks=ranks,
        ai_available=ai_service.is_available(),
        ai_vision_available=ai_service.is_vision_available(),
    )
