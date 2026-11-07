from pydantic import BaseModel

from app.schemas.types import UtcDateTime


class RarityConfigEntry(BaseModel):
    key: str
    label: str
    color: str
    base_elo: int


class RankConfigEntry(BaseModel):
    key: str
    name: str
    icon: str
    min_elo: int
    max_elo: int | None
    description: str


class AchievementPublic(BaseModel):
    code: str
    name: str
    description: str
    icon: str
    category: str | None = None
    tier: str | None = None
    unlocked: bool
    unlocked_at: UtcDateTime | None

    model_config = {"from_attributes": True}


class GameConfig(BaseModel):
    """Configuración de juego expuesta al cliente para que la UI nunca
    tenga que hardcodear valores de ELO o rangos."""

    rarities: list[RarityConfigEntry]
    ranks: list[RankConfigEntry]
    ai_available: bool
    ai_vision_available: bool = False
