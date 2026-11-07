from datetime import datetime

from pydantic import BaseModel

from app.schemas.types import UtcDateTime


class RankInfo(BaseModel):
    key: str
    name: str
    icon: str
    min_elo: int
    max_elo: int | None
    description: str


class UserPublic(BaseModel):
    id: int
    username: str
    display_name: str
    avatar: str | None
    elo: int
    rank: RankInfo
    created_at: UtcDateTime
    is_admin: bool = False

    model_config = {"from_attributes": True}


class UserStats(BaseModel):
    total_captures: int
    species_discovered: int
    total_species: int
    rare_plus_species: int
    rarest_species_name: str | None
    biggest_catch_weight_kg: float | None
    biggest_catch_species_name: str | None


class UserProfile(BaseModel):
    user: UserPublic
    stats: UserStats
    # Vitrina de insignias (máx. 3). Import diferido para evitar el ciclo
    # common -> types -> user.
    showcase: list["AchievementPublic"] = []


from app.schemas.common import AchievementPublic  # noqa: E402

UserProfile.model_rebuild()
