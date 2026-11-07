from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuoteTrigger:
    """Contexto en que puede aparecer una frase de celebración."""

    GENERIC = "GENERIC"
    NEW_SPECIES = "NEW_SPECIES"
    PERSONAL_RECORD = "PERSONAL_RECORD"
    HEAVY_CATCH = "HEAVY_CATCH"  # peso destacable
    RARE_PLUS = "RARE_PLUS"      # rareza RARE, EPIC, LEGENDARY o MYTHIC


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    trigger: Mapped[str] = mapped_column(String(20), default=QuoteTrigger.GENERIC, nullable=False)
    min_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
