from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Spot(Base):
    """Punto de pesca guardado. PRIVADO por defecto: sus coordenadas solo las
    ve el dueño y los amigos con los que lo comparte explícitamente."""

    __tablename__ = "spots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship()
    photos: Mapped[list["SpotPhoto"]] = relationship(cascade="all, delete-orphan", order_by="SpotPhoto.id")
    shares: Mapped[list["SpotShare"]] = relationship(cascade="all, delete-orphan")


class SpotPhoto(Base):
    __tablename__ = "spot_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    spot_id: Mapped[int] = mapped_column(ForeignKey("spots.id"), nullable=False, index=True)
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    thumbnail_path: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SpotShare(Base):
    """Amigo concreto con el que el dueño comparte un spot."""

    __tablename__ = "spot_shares"
    __table_args__ = (UniqueConstraint("spot_id", "user_id", name="uq_spot_share"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    spot_id: Mapped[int] = mapped_column(ForeignKey("spots.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
