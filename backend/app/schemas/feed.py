from pydantic import BaseModel

from app.schemas.types import UtcDateTime
from app.schemas.user import UserPublic


class FeedEntry(BaseModel):
    """Una captura tal y como aparece en el feed de comunidad.

    IMPORTANTE (privacidad): nunca incluye `latitude`/`longitude`, ni siquiera
    de un amigo; solo el nombre del sitio. Misma regla que ya aplica
    `app/api/routes/map.py` para las coordenadas de otros usuarios.
    """

    id: int
    user: UserPublic
    fish_species_name: str
    rarity: str
    image_url: str | None
    thumbnail_url: str | None
    weight_kg: float
    length_cm: float
    location_name: str | None
    captured_at: UtcDateTime
    caption: str | None = None  # reservado: de momento no hay descripción de captura
    like_count: int
    comment_count: int
    liked_by_me: bool
