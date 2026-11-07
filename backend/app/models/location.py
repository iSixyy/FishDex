from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LocationType:
    COAST = "COAST"
    RIVER = "RIVER"
    RESERVOIR = "RESERVOIR"
    LAKE = "LAKE"
    SEA = "SEA"


class Location(Base):
    """Catálogo de ubicaciones de pesca españolas conocidas (costas, ríos,
    embalses, lagos, mares) usado para geocodificación aproximada offline
    y para mostrar nombres legibles en lugar de coordenadas."""

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location_type: Mapped[str] = mapped_column(String(20), nullable=False)  # LocationType
    autonomous_community: Mapped[str] = mapped_column(String(80), nullable=False)
    province: Mapped[str | None] = mapped_column(String(80), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    # Radio aproximado (km) usado para calcular la ubicación más cercana a una captura.
    approx_radius_km: Mapped[float] = mapped_column(Float, default=15.0, nullable=False)
