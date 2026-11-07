from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.fish_species import FishSpecies


class RegulationScope:
    STATE = "STATE"        # regulación estatal
    AUTONOMOUS = "AUTONOMOUS"  # regulación autonómica


class Regulation(Base):
    """Normativa de pesca para una especie. Puede haber varias filas por
    especie: una estatal y/o una o más autonómicas (por comunidad).

    Si no existe fila para una especie/zona, la app debe mostrar
    "Información no disponible" y NUNCA inventar un dato legal.
    """

    __tablename__ = "regulations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fish_species_id: Mapped[int] = mapped_column(ForeignKey("fish_species.id"), nullable=False, index=True)

    scope: Mapped[str] = mapped_column(String(20), nullable=False)  # RegulationScope
    autonomous_community: Mapped[str | None] = mapped_column(String(80), nullable=True)  # solo si scope=AUTONOMOUS

    legal_min_length_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    closed_season: Mapped[str | None] = mapped_column(String(255), nullable=True)  # veda, texto libre
    # Veda en formato máquina "MM-DD" (ambos inclusive; puede cruzar el año,
    # p.ej. 11-01 -> 03-15). Solo se rellenan con dato oficial verificado.
    closed_season_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    closed_season_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    daily_catch_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)  # fuente oficial consultada

    species: Mapped["FishSpecies"] = relationship(back_populates="regulations")
