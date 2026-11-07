from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.fish import FishDexProgress
from app.schemas.user import UserPublic

from app.schemas.types import UtcDateTime


class FriendRequestCreate(BaseModel):
    # Mismo rango que `RegisterRequest.username` (app/schemas/auth.py): un
    # username real nunca puede quedar fuera de esos límites.
    to_username: str = Field(min_length=3, max_length=30)


class FriendRequestPublic(BaseModel):
    id: int
    from_user: UserPublic
    to_user: UserPublic
    status: str
    created_at: UtcDateTime


class FriendPublic(BaseModel):
    user: UserPublic
    species_discovered: int
    total_species: int
    rare_plus_species: int


class FriendFishDex(BaseModel):
    """FishDex de un amigo: nunca incluye coordenadas exactas."""

    user: UserPublic
    dex: FishDexProgress


class ComparisonEntry(BaseModel):
    user: UserPublic
    species_discovered: int
    rare_plus_species: int
    legendary_plus_species: int


class FriendComparison(BaseModel):
    me: ComparisonEntry
    friend: ComparisonEntry
