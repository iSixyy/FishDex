from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.regulation import Regulation


class WaterType:
    FRESH = "FRESH"       # agua dulce
    SALT = "SALT"         # marina
    BRACKISH = "BRACKISH"  # salobre


class SpeciesOrigin:
    SEED = "SEED"  # catálogo curado a mano
    AI = "AI"      # añadida al identificar una foto con IA


class FishSpecies(Base):
    """Datos BIOLÓGICOS de la especie. La regulación legal vive aparte,
    en `Regulation`, porque depende de la zona/comunidad autónoma."""

    __tablename__ = "fish_species"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dex_number: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    scientific_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    fun_fact: Mapped[str] = mapped_column(Text, nullable=False)

    min_weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    max_weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    approx_min_length_cm: Mapped[float] = mapped_column(Float, nullable=False)
    approx_max_length_cm: Mapped[float] = mapped_column(Float, nullable=False)

    rarity: Mapped[str] = mapped_column(String(20), nullable=False)  # ver core.game_config.Rarity
    habitat: Mapped[str] = mapped_column(String(120), nullable=False)
    water_type: Mapped[str] = mapped_column(String(20), nullable=False)  # WaterType
    region: Mapped[str] = mapped_column(String(120), nullable=False)  # zonas típicas en España

    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Dificultad de captura 1-10 estimada por la IA al dar de alta la especie.
    # La rareza se deriva de ella UNA sola vez y queda fijada en la especie:
    # una trucha es igual de rara para todos los usuarios.
    catch_difficulty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    origin: Mapped[str] = mapped_column(String(10), default=SpeciesOrigin.SEED, nullable=False)
    # Quién y cuándo la dio de alta la IA (None en las del catálogo semilla).
    # Sirve para limitar cuántas especies nuevas añade cada usuario al día.
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, server_default=func.now())

    regulations: Mapped[list["Regulation"]] = relationship(back_populates="species", cascade="all, delete-orphan")
