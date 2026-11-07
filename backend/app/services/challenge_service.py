"""Retos 1v1, torneos entre amigos y eventos oficiales.

Flujo:
- Reto / torneo: el creador invita a amigos. Queda PENDIENTE hasta que el
  primer invitado acepta; en ese momento se ACTIVA y empieza a contar su
  duración. Si todos los invitados rechazan, se CANCELA.
- Evento oficial: lo crea un administrador, está activo desde el primer
  momento, se notifica a todos y cualquiera puede apuntarse.

Puntuación: solo cuentan capturas de participantes que ACEPTARON, pescadas
(`captured_at`) y registradas en el servidor (`created_at`) dentro de la
ventana del reto. Usar también `created_at` impide colar capturas antiguas
cambiando la fecha en el móvil.
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.capture import Capture
from app.models.challenge import (
    Challenge,
    ChallengeCriterion,
    ChallengeKind,
    ChallengeParticipant,
    ChallengeStatus,
    ParticipantStatus,
)
from app.models.fish_species import FishSpecies
from app.models.friend import Friend
from app.models.user import User
from app.services import achievement_service, notification_service

ENDING_SOON_HOURS = 24

CRITERION_LABELS = {
    ChallengeCriterion.HEAVIEST: "la pieza más pesada",
    ChallengeCriterion.LONGEST: "la pieza más larga",
    ChallengeCriterion.MOST_CAPTURES: "más capturas",
    ChallengeCriterion.MOST_SPECIES: "más especies distintas",
}


def _now() -> datetime:
    # Sin microsegundos: `created_at` lo rellena SQLite (CURRENT_TIMESTAMP) con
    # precisión de segundos, y en la comparación como texto una captura del
    # mismo segundo en que empieza el reto quedaba fuera ("10:00:00" < "10:00:00.123").
    return datetime.now(timezone.utc).replace(microsecond=0)


def as_utc(moment: datetime | None) -> datetime | None:
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _friend_ids(db: Session, user_id: int) -> set[int]:
    return {row[0] for row in db.query(Friend.friend_id).filter(Friend.user_id == user_id).all()}


def _validate_species(db: Session, species_id: int | None) -> None:
    if species_id is not None and db.query(FishSpecies).filter(FishSpecies.id == species_id).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Especie no encontrada")


def create_friend_challenge(
    db: Session,
    creator: User,
    *,
    friend_ids: list[int],
    title: str | None,
    criterion: str,
    duration_days: int,
    species_id: int | None,
) -> Challenge:
    invited = list(dict.fromkeys(i for i in friend_ids if i != creator.id))
    if not invited:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invita al menos a un amigo")
    if set(invited) - _friend_ids(db, creator.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo puedes retar a tus amigos")
    _validate_species(db, species_id)

    kind = ChallengeKind.DUEL if len(invited) == 1 else ChallengeKind.TOURNAMENT
    default_title = "Reto 1 contra 1" if kind == ChallengeKind.DUEL else "Torneo entre amigos"
    challenge = Challenge(
        creator_id=creator.id,
        kind=kind,
        title=(title or default_title).strip()[:80],
        criterion=criterion,
        fish_species_id=species_id,
        duration_days=duration_days,
        status=ChallengeStatus.PENDING,
    )
    challenge.participants.append(ChallengeParticipant(user_id=creator.id, status=ParticipantStatus.ACCEPTED))
    for friend_id in invited:
        challenge.participants.append(ChallengeParticipant(user_id=friend_id, status=ParticipantStatus.INVITED))
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    label = "un reto" if kind == ChallengeKind.DUEL else "un torneo"
    notification_service.notify_users(
        db, invited, "¡Te han retado!",
        f"{creator.display_name} te invita a {label}: {CRITERION_LABELS[criterion]} en {duration_days} días.",
        {"type": "challenge_invite", "challenge_id": challenge.id},
    )
    return challenge


def create_event(
    db: Session, admin: User, *, title: str, criterion: str, duration_days: int, species_id: int | None
) -> Challenge:
    if not admin.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo la administración puede crear eventos oficiales")
    _validate_species(db, species_id)
    now = _now()
    event = Challenge(
        creator_id=admin.id,
        kind=ChallengeKind.EVENT,
        title=title.strip()[:80],
        criterion=criterion,
        fish_species_id=species_id,
        duration_days=duration_days,
        starts_at=now,
        ends_at=now + timedelta(days=duration_days),
        status=ChallengeStatus.ACTIVE,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    notification_service.notify_everyone(
        db, "Nuevo evento oficial", f"{event.title}: gana quien consiga {CRITERION_LABELS[criterion]}. ¡Apúntate!",
        {"type": "event", "challenge_id": event.id},
    )
    return event


def _participant(challenge: Challenge, user_id: int) -> ChallengeParticipant | None:
    return next((p for p in challenge.participants if p.user_id == user_id), None)


def get_visible_challenge_or_404(db: Session, user: User, challenge_id: int) -> Challenge:
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge is None or (challenge.kind != ChallengeKind.EVENT and _participant(challenge, user.id) is None):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reto no encontrado")
    finalize_if_due(db, challenge)
    return challenge


def respond(db: Session, user: User, challenge_id: int, accept: bool) -> Challenge:
    challenge = get_visible_challenge_or_404(db, user, challenge_id)
    participant = _participant(challenge, user.id)
    if challenge.kind == ChallengeKind.EVENT or participant is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No tienes una invitación a este reto")
    if participant.status != ParticipantStatus.INVITED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya has respondido a esta invitación")
    if challenge.status not in (ChallengeStatus.PENDING, ChallengeStatus.ACTIVE):
        raise HTTPException(status.HTTP_409_CONFLICT, "Este reto ya no admite respuestas")

    participant.status = ParticipantStatus.ACCEPTED if accept else ParticipantStatus.DECLINED
    if accept and challenge.status == ChallengeStatus.PENDING:
        now = _now()
        challenge.status = ChallengeStatus.ACTIVE
        challenge.starts_at = now
        challenge.ends_at = now + timedelta(days=challenge.duration_days)
    elif not accept and all(
        p.status == ParticipantStatus.DECLINED for p in challenge.participants if p.user_id != challenge.creator_id
    ):
        challenge.status = ChallengeStatus.CANCELLED
    db.commit()
    db.refresh(challenge)

    verb = "ha aceptado" if accept else "ha rechazado"
    notification_service.notify_users(
        db, [challenge.creator_id], "Respuesta a tu reto", f"{user.display_name} {verb} «{challenge.title}».",
        {"type": "challenge_response", "challenge_id": challenge.id},
    )
    return challenge


def join_event(db: Session, user: User, challenge_id: int) -> Challenge:
    challenge = get_visible_challenge_or_404(db, user, challenge_id)
    if challenge.kind != ChallengeKind.EVENT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo puedes apuntarte a eventos oficiales")
    if challenge.status != ChallengeStatus.ACTIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "El evento ya ha terminado")
    if _participant(challenge, user.id) is None:
        challenge.participants.append(ChallengeParticipant(user_id=user.id, status=ParticipantStatus.ACCEPTED))
        db.commit()
        db.refresh(challenge)
    return challenge


def cancel(db: Session, user: User, challenge_id: int) -> None:
    challenge = get_visible_challenge_or_404(db, user, challenge_id)
    if challenge.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo quien creó el reto puede cancelarlo")
    if challenge.status == ChallengeStatus.FINISHED:
        raise HTTPException(status.HTTP_409_CONFLICT, "El reto ya ha terminado")
    challenge.status = ChallengeStatus.CANCELLED
    db.commit()


def list_for_user(db: Session, user: User) -> list[Challenge]:
    challenges = (
        db.query(Challenge)
        .outerjoin(ChallengeParticipant, ChallengeParticipant.challenge_id == Challenge.id)
        .filter(or_(ChallengeParticipant.user_id == user.id, Challenge.kind == ChallengeKind.EVENT))
        .distinct()
        .order_by(Challenge.created_at.desc(), Challenge.id.desc())
        .all()
    )
    for challenge in challenges:
        finalize_if_due(db, challenge)
    return challenges


def scores(db: Session, challenge: Challenge) -> list[tuple[User, float]]:
    """Clasificación actual: (usuario, valor) de mayor a menor. Incluye a
    todos los participantes que aceptaron, aunque aún no puntúen (0)."""
    accepted = [p.user for p in challenge.participants if p.status == ParticipantStatus.ACCEPTED]
    if not accepted or challenge.starts_at is None:
        return [(u, 0.0) for u in accepted]
    start = as_utc(challenge.starts_at).replace(microsecond=0)
    end = as_utc(challenge.ends_at)
    value = {
        ChallengeCriterion.HEAVIEST: func.max(Capture.weight_kg),
        ChallengeCriterion.LONGEST: func.max(Capture.length_cm),
        ChallengeCriterion.MOST_CAPTURES: func.count(Capture.id),
        ChallengeCriterion.MOST_SPECIES: func.count(func.distinct(Capture.fish_species_id)),
    }[challenge.criterion]
    query = db.query(Capture.user_id, value).filter(
        Capture.user_id.in_([u.id for u in accepted]),
        Capture.captured_at >= start,
        Capture.captured_at <= end,
        Capture.created_at >= start,
        Capture.created_at <= end,
    )
    if challenge.fish_species_id is not None:
        query = query.filter(Capture.fish_species_id == challenge.fish_species_id)
    totals = {user_id: float(v or 0) for user_id, v in query.group_by(Capture.user_id).all()}
    ranking = [(u, totals.get(u.id, 0.0)) for u in accepted]
    ranking.sort(key=lambda item: item[1], reverse=True)
    return ranking


def finalize_if_due(db: Session, challenge: Challenge) -> bool:
    """Cierra un reto activo cuya fecha de fin ya pasó: fija ganador (si hay
    un único primero con puntuación > 0), notifica y revisa logros."""
    if challenge.status != ChallengeStatus.ACTIVE or challenge.ends_at is None or as_utc(challenge.ends_at) > _now():
        return False
    ranking = scores(db, challenge)
    winner = None
    if ranking and ranking[0][1] > 0 and (len(ranking) == 1 or ranking[0][1] > ranking[1][1]):
        winner = ranking[0][0]
    challenge.status = ChallengeStatus.FINISHED
    challenge.winner_id = winner.id if winner else None
    if winner is not None:
        achievement_service.evaluate_achievements(db, winner.id)
    db.commit()
    participant_ids = [p.user_id for p in challenge.participants if p.status == ParticipantStatus.ACCEPTED]
    result = f"¡Ha ganado {winner.display_name}!" if winner else "Ha terminado en empate."
    notification_service.notify_users(
        db, participant_ids, f"«{challenge.title}» ha terminado", result,
        {"type": "challenge_finished", "challenge_id": challenge.id},
    )
    return True


def run_scheduled(db: Session) -> None:
    """Tarea periódica: cierra retos vencidos y avisa de los que acaban en
    menos de 24 h (una sola vez por reto)."""
    now = _now()
    for challenge in db.query(Challenge).filter(Challenge.status == ChallengeStatus.ACTIVE).all():
        if finalize_if_due(db, challenge):
            continue
        ends_at = as_utc(challenge.ends_at)
        if ends_at and not challenge.ending_soon_notified and ends_at - now <= timedelta(hours=ENDING_SOON_HOURS):
            challenge.ending_soon_notified = True
            db.commit()
            participant_ids = [p.user_id for p in challenge.participants if p.status == ParticipantStatus.ACCEPTED]
            notification_service.notify_users(
                db, participant_ids, "¡Último día!", f"«{challenge.title}» termina en menos de 24 horas.",
                {"type": "challenge_ending", "challenge_id": challenge.id},
            )
