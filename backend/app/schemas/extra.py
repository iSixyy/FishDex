"""Esquemas de las funcionalidades nuevas: IA, spots, retos, rankings
ampliados, dispositivos y normativa."""
from pydantic import BaseModel, Field, field_validator

from app.models.challenge import ChallengeCriterion
from app.schemas.fish import FishCatalogEntry
from app.schemas.types import UtcDateTime
from app.schemas.user import UserPublic


# --- IA ---
class AIIdentifyResponse(BaseModel):
    available: bool          # hay IA de visión configurada y respondiendo
    identified: bool         # la IA ha reconocido un pez
    message: str
    species: FishCatalogEntry | None = None
    species_is_new_in_catalog: bool = False
    suggested_name: str | None = None
    scientific_name: str | None = None
    confidence: float | None = None
    estimated_weight_kg: float | None = None
    estimated_length_cm: float | None = None
    catch_difficulty: int | None = None


# --- Dispositivos ---
class DeviceRegister(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    platform: str | None = Field(default=None, max_length=20)


# --- Spots ---
class SpotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class SpotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)


class SpotShareUpdate(BaseModel):
    friend_ids: list[int] = Field(default_factory=list, max_length=200)


class SpotPhotoPublic(BaseModel):
    id: int
    image_url: str
    thumbnail_url: str


class SpotPublic(BaseModel):
    id: int
    owner: UserPublic
    is_mine: bool
    name: str
    notes: str | None
    latitude: float
    longitude: float
    photos: list[SpotPhotoPublic]
    shared_with: list[int]  # ids de amigos (solo se rellena para el dueño)
    created_at: UtcDateTime


# --- Retos ---
class _ChallengeRules(BaseModel):
    criterion: str
    duration_days: int = Field(ge=1, le=60)
    species_id: int | None = None

    @field_validator("criterion")
    @classmethod
    def valid_criterion(cls, value: str) -> str:
        if value not in ChallengeCriterion.ALL:
            raise ValueError(f"Criterio no válido. Opciones: {', '.join(ChallengeCriterion.ALL)}")
        return value


class ChallengeCreate(_ChallengeRules):
    friend_ids: list[int] = Field(min_length=1, max_length=30)
    title: str | None = Field(default=None, max_length=80)


class EventCreate(_ChallengeRules):
    title: str = Field(min_length=3, max_length=80)


class ChallengeResponse(BaseModel):
    accept: bool


class ChallengeParticipantPublic(BaseModel):
    user: UserPublic
    status: str
    score: float
    position: int | None


class ChallengePublic(BaseModel):
    id: int
    kind: str
    title: str
    criterion: str
    criterion_label: str
    species_id: int | None
    species_name: str | None
    duration_days: int
    status: str
    starts_at: UtcDateTime | None
    ends_at: UtcDateTime | None
    creator: UserPublic
    winner: UserPublic | None
    my_status: str | None  # INVITED / ACCEPTED / DECLINED, None si no participo (eventos)
    participants: list[ChallengeParticipantPublic]


# --- Rankings ---
class RankedValueEntry(BaseModel):
    position: int
    user: UserPublic
    value: float


class RankingPage(BaseModel):
    entries: list[RankedValueEntry]
    me: RankedValueEntry | None


# --- Normativa ---
class RegulationWarning(BaseModel):
    kind: str
    severity: str  # "danger" | "info"
    message: str
    source: str | None


class RegulationCheck(BaseModel):
    autonomous_community: str | None
    has_data: bool
    warnings: list[RegulationWarning]


# --- Logros / vitrina ---
class ShowcaseUpdate(BaseModel):
    codes: list[str] = Field(default_factory=list, max_length=3)
