from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserBlock(Base):
    """`blocker` ha bloqueado a `blocked`: dejan de ser amigos, no pueden
    volver a pedirse amistad y no se ven los comentarios del otro."""

    __tablename__ = "user_blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    blocker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    blocked_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReportTarget:
    USER = "USER"
    CAPTURE = "CAPTURE"
    COMMENT = "COMMENT"

    ALL = (USER, CAPTURE, COMMENT)


class ReportReason:
    SPAM = "SPAM"
    OFFENSIVE = "OFFENSIVE"          # contenido ofensivo o acoso
    FAKE_CAPTURE = "FAKE_CAPTURE"    # captura falsa o medidas trucadas
    INAPPROPRIATE = "INAPPROPRIATE"  # foto inapropiada
    OTHER = "OTHER"

    ALL = (SPAM, OFFENSIVE, FAKE_CAPTURE, INAPPROPRIATE, OTHER)


class ReportStatus:
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class Report(Base):
    """Denuncia de un usuario, captura o comentario para que la revise la
    administración (lo exigen Google Play y la App Store en apps sociales)."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(10), nullable=False)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    details: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default=ReportStatus.OPEN, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
