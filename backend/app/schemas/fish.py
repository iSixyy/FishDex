from pydantic import BaseModel


class RegulationPublic(BaseModel):
    scope: str
    autonomous_community: str | None
    legal_min_length_cm: float | None
    closed_season: str | None
    daily_catch_limit: int | None
    closed_season_start: str | None = None
    closed_season_end: str | None = None
    notes: str | None
    source: str | None

    model_config = {"from_attributes": True}


class FishSpeciesDetail(BaseModel):
    id: int
    dex_number: int
    name: str
    scientific_name: str
    description: str
    fun_fact: str
    min_weight_kg: float
    max_weight_kg: float
    approx_min_length_cm: float
    approx_max_length_cm: float
    rarity: str
    rarity_label: str
    rarity_color: str
    habitat: str
    water_type: str
    region: str
    image_url: str | None
    catch_difficulty: int | None = None
    origin: str = "SEED"
    regulations: list[RegulationPublic]


class FishSpeciesSummary(BaseModel):
    """Ficha resumida para el listado de la FishDex."""

    id: int
    dex_number: int
    name: str | None  # None si está bloqueada
    rarity: str | None
    rarity_label: str | None
    rarity_color: str | None
    image_url: str | None
    water_type: str | None = None
    unlocked: bool


class FishDexProgress(BaseModel):
    discovered: int
    total: int
    species: list[FishSpeciesSummary]


class FishCatalogEntry(BaseModel):
    """Entrada del catálogo COMPLETO de especies (nombre siempre visible).

    Se usa para el selector de especie al registrar una captura: el usuario
    necesita poder elegir por nombre incluso una especie que nunca ha
    pescado. El "bloqueo" de la FishDex es solo una vista de progreso, no
    un secreto de qué especies existen (igual que una guía de pesca real).
    """

    id: int
    dex_number: int
    name: str
    rarity: str
    rarity_label: str
    rarity_color: str
    water_type: str
    origin: str = "SEED"
