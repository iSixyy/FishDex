from datetime import datetime

from pydantic import BaseModel

from app.schemas.types import UtcDateTime


class MapCapturePin(BaseModel):
    id: int
    fish_species_name: str
    rarity: str
    image_url: str | None
    thumbnail_url: str | None
    weight_kg: float
    length_cm: float
    latitude: float
    longitude: float
    location_name: str | None
    captured_at: UtcDateTime
