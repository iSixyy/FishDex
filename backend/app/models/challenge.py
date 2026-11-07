from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.fish_species import FishSpecies
    from app.models.user import User


class ChallengeKind:
    DUEL = "DUEL"              # 1 contra 1 entre amigos
    TOURNAMENT = "TOURNAMENT"  # varios amigos
    EVENT = "EVENT"            # evento oficial de la administración, abierto a todos

    ALL = (DUEL, TOURNAMENT, EVENT)


class ChallengeCriterion:
    HEAVIEST = "HEAVIEST"          # pieza más pesada
    LONGEST = "LONGEST"            # pieza más larga
    MOST_CAPTURES = "MOST_CAPTURES"
    MOST_SPECIES = "MOST_SPECIES"  # especies distintas

    ALL = (HEAVIEST, LONGEST, MOST_CAPTURES, MOST_SPECIES)


class ChallengeStatus:
    PENDING = "PENDING"      # esperando a que algún invitado acepte
    ACTIVE = "ACTIVE"
    FINISHED = "FINISHED"
    CANCELLED = "CANCELLED"


class ParticipantStatus:
    INVITED = "INVITED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    criterion: Mapped[str] = mapped_column(String(20), nullable=False)
    fish_species_id: Mapped[int | None] = mapped_column(ForeignKey("fish_species.id"), nullable=True)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    # Se fijan al activarse (cuando el primer invitado acepta) o al crear un evento.
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default=ChallengeStatus.PENDING, nullable=False)
    winner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    ending_soon_notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["User"] = relationship(foreign_keys=[creator_id])
    species: Mapped["FishSpecies | None"] = relationship()
    participants: Mapped[list["ChallengeParticipant"]] = relationship(
        back_populates="challenge", cascade="all, delete-orphan"
    )


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"
    __table_args__ = (UniqueConstraint("challenge_id", "user_id", name="uq_challenge_participant"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(10), default=ParticipantStatus.INVITED, nullable=False)

    challenge: Mapped["Challenge"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()
