from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SeasonTier:
    CHAMPION = "CHAMPION"        # 1.º
    PODIUM = "PODIUM"            # 2.º y 3.º
    TOP10 = "TOP10"              # 4.º a 10.º
    PARTICIPANT = "PARTICIPANT"  # sumó puntos en la temporada


class SeasonAward(Base):
    """Insignia ganada al cerrar una temporada (un trimestre)."""

    __tablename__ = "season_awards"
    __table_args__ = (UniqueConstraint("season_key", "user_id", name="uq_season_award"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    season_key: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # "2026-T4"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    tier: Mapped[str] = mapped_column(String(12), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
