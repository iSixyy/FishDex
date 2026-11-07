from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class CaptureLike(Base):
    """Un "me gusta" de un usuario sobre una captura. Un usuario solo puede
    dar like una vez a cada captura (UniqueConstraint), lo que además permite
    implementar el like de forma idempotente atrapando el IntegrityError."""

    __tablename__ = "capture_likes"
    __table_args__ = (UniqueConstraint("capture_id", "user_id", name="uq_capture_like"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    capture_id: Mapped[int] = mapped_column(ForeignKey("captures.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CaptureComment(Base):
    """Comentario de texto libre de un usuario sobre una captura."""

    __tablename__ = "capture_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    capture_id: Mapped[int] = mapped_column(ForeignKey("captures.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
