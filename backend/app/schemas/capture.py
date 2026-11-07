from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, Field, field_validator

from app.core.game_config import MAX_CAPTURED_AT_AGE_DAYS

from app.schemas.types import UtcDateTime


class CaptureCreate(BaseModel):
    fish_species_id: int
    weight_kg: float = Field(gt=0, le=500)
    length_cm: float = Field(gt=0, le=1000)
    captured_at: datetime  # esquema de ENTRADA: el validador lo normaliza a UTC
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_name: str | None = Field(default=None, max_length=150)
    bait_technique: str | None = Field(default=None, max_length=120)
    client_id: str | None = Field(default=None, min_length=1, max_length=64)

    @field_validator("captured_at")
    @classmethod
    def within_allowed_window(cls, value: datetime) -> datetime:
        # Una fecha sin zona horaria se interpreta como UTC: así la comparación
        # siempre es entre datetimes "aware" y nunca lanza TypeError. Se evita
        # `datetime.utcnow()`, deprecado desde Python 3.12 y de resultado naive.
        moment = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if moment > now:
            raise ValueError("La fecha de captura no puede ser futura")
        if moment < now - timedelta(days=MAX_CAPTURED_AT_AGE_DAYS):
            raise ValueError(f"La fecha de captura no puede tener más de {MAX_CAPTURED_AT_AGE_DAYS} días de antigüedad")
        # Se devuelve `moment` (normalizado a UTC), no `value`: SQLite ignora el
        # offset de un datetime aware al guardarlo (`DateTime(timezone=True)` es
        # un no-op ahí) y conserva solo los dígitos de hora local, desplazando
        # el instante real. Normalizando aquí a UTC, lo que se persiste siempre
        # representa el mismo instante sin importar el offset de origen.
        return moment.astimezone(timezone.utc)


class CaptureUpdate(BaseModel):
    """Campos editables de una captura ya registrada (todos opcionales)."""

    fish_species_id: int | None = None
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    length_cm: float | None = Field(default=None, gt=0, le=1000)
    location_name: str | None = Field(default=None, max_length=150)
    bait_technique: str | None = Field(default=None, max_length=120)

    @field_validator("fish_species_id", "weight_kg", "length_cm")
    @classmethod
    def not_null(cls, value):
        # Se pueden omitir, pero no mandarse explícitamente a null.
        if value is None:
            raise ValueError("No puede ser nulo")
        return value


class CapturePublic(BaseModel):
    id: int
    fish_species_id: int
    fish_species_name: str
    rarity: str
    image_url: str | None
    thumbnail_url: str | None
    weight_kg: float
    length_cm: float
    latitude: float | None
    longitude: float | None
    location_name: str | None
    bait_technique: str | None
    captured_at: UtcDateTime
    elo_earned: int
    is_new_species: bool
    is_personal_record_weight: bool
    is_personal_record_length: bool
    weather: dict | None = None


class PersonalRecordInfo(BaseModel):
    previous_weight_kg: float | None
    previous_length_cm: float | None
    new_weight_kg: float
    new_length_cm: float
    is_new_record: bool


class CaptureResult(BaseModel):
    """Respuesta enriquecida usada para la pantalla de celebración."""

    capture: CapturePublic
    elo_earned: int
    total_elo: int
    rank: str
    is_new_species: bool
    record: PersonalRecordInfo
    quote: str
    new_achievements: list[str]
