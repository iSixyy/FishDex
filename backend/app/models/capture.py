from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.fish_species import FishSpecies
    from app.models.user import User


class Capture(Base):
    __tablename__ = "captures"
    # Índice (y no UniqueConstraint) con nombre fijo para que
    # `run_light_migrations` pueda crearlo con `CREATE UNIQUE INDEX IF NOT
    # EXISTS` en bases ya existentes sin duplicarlo en las nuevas. Los NULL
    # no colisionan entre sí, así que las capturas sin `client_id` no se ven
    # afectadas.
    __table_args__ = (Index("uq_capture_client_id", "user_id", "client_id", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    fish_species_id: Mapped[int] = mapped_column(ForeignKey("fish_species.id"), nullable=False, index=True)

    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String(255), nullable=True)

    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    length_cm: Mapped[float] = mapped_column(Float, nullable=False)

    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    autonomous_community: Mapped[str | None] = mapped_column(String(80), nullable=True)

    # Texto libre opcional, ej. "Raglú / Spinning". Sin catálogo cerrado: es
    # solo informativo, no afecta a ELO ni a ninguna otra regla de juego.
    bait_technique: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Identificador generado por el móvil para cada captura. Hace idempotente
    # el POST: si la respuesta se pierde (timeout con la subida ya procesada)
    # y la cola offline reintenta, no se duplica la captura ni su ELO.
    client_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Instantánea JSON del clima/mar/luna en el sitio y momento de registrar
    # la captura (Open-Meteo). Solo informativa; None si no hubo coordenadas
    # o el servicio no respondió.
    weather_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Default en Python (además del del servidor, para filas antiguas): SQLite
    # guarda CURRENT_TIMESTAMP como "YYYY-MM-DD HH:MM:SS", sin microsegundos,
    # y al compararlo como texto con un límite "…:SS.000000" del mismo
    # segundo quedaba fuera de rango (ventanas de retos, límite diario).
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    # Captura y suelta: el pescador devolvió el pez al agua (bonus de ELO).
    released: Mapped[bool] = mapped_column(default=False, nullable=False)

    elo_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_new_species: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_personal_record_weight: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_personal_record_length: Mapped[bool] = mapped_column(default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="captures")
    species: Mapped["FishSpecies"] = relationship()
