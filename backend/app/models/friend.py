from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class FriendRequestStatus:
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class FriendRequest(Base):
    __tablename__ = "friend_requests"
    __table_args__ = (UniqueConstraint("from_user_id", "to_user_id", name="uq_friend_request_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default=FriendRequestStatus.PENDING, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    from_user: Mapped["User"] = relationship(foreign_keys=[from_user_id])
    to_user: Mapped["User"] = relationship(foreign_keys=[to_user_id])


class Friend(Base):
    """Relación de amistad ya confirmada. Se almacena en ambos sentidos
    (user_id <-> friend_id) para simplificar las consultas de lectura."""

    __tablename__ = "friends"
    __table_args__ = (UniqueConstraint("user_id", "friend_id", name="uq_friend_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    friend_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
