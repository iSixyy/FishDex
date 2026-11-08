from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.game_config import Rarity
from app.models.capture import Capture
from app.models.fish_species import FishSpecies
from app.models.friend import Friend, FriendRequest, FriendRequestStatus
from app.models.user import User
from app.services import achievement_service, notification_service

RARE_PLUS = {Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY, Rarity.MYTHIC}

# Tras un rechazo, el mismo remitente debe esperar antes de volver a pedir
# amistad: sin esto podía reenviar al instante, con un aviso push cada vez.
REJECTED_REQUEST_COOLDOWN = timedelta(days=7)
LEGENDARY_PLUS = {Rarity.LEGENDARY, Rarity.MYTHIC}


def _are_friends(db: Session, user_id: int, other_id: int) -> bool:
    return (
        db.query(Friend)
        .filter(Friend.user_id == user_id, Friend.friend_id == other_id)
        .first()
        is not None
    )


def send_friend_request(db: Session, from_user: User, to_username: str) -> FriendRequest:
    # Sin distinguir mayúsculas: "Pepe" encuentra a "pepe".
    to_user = db.query(User).filter(func.lower(User.username) == to_username.strip().lower()).first()
    if to_user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if to_user.id == from_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes enviarte una solicitud a ti mismo")
    if _are_friends(db, from_user.id, to_user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya sois amigos")

    # Si el otro ya me había pedido amistad, pedírsela yo equivale a aceptar.
    incoming = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.from_user_id == to_user.id,
            FriendRequest.to_user_id == from_user.id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .first()
    )
    if incoming is not None:
        accept_friend_request(db, from_user, incoming.id)
        db.refresh(incoming)
        return incoming

    existing = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.from_user_id == from_user.id,
            FriendRequest.to_user_id == to_user.id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una solicitud pendiente")

    # La UniqueConstraint (from_user_id, to_user_id) admite una sola fila por
    # sentido. Si ya hubo una solicitud (rechazada, o aceptada y la amistad se
    # eliminó después), se reabre esa fila; insertar otra chocaría con la
    # restricción y el usuario no podría volver a solicitar amistad nunca.
    request = (
        db.query(FriendRequest)
        .filter(FriendRequest.from_user_id == from_user.id, FriendRequest.to_user_id == to_user.id)
        .first()
    )
    if request is None:
        request = FriendRequest(from_user_id=from_user.id, to_user_id=to_user.id)
        db.add(request)
    else:
        if request.status == FriendRequestStatus.REJECTED:
            sent_at = request.created_at
            if sent_at is not None and sent_at.tzinfo is None:
                sent_at = sent_at.replace(tzinfo=timezone.utc)
            if sent_at is not None and datetime.now(timezone.utc) - sent_at < REJECTED_REQUEST_COOLDOWN:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "Esa persona rechazó tu solicitud hace poco. Espera unos días para volver a intentarlo.",
                )
        request.status = FriendRequestStatus.PENDING
        request.created_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        # "check-then-insert": el `existing` de arriba no cierra la ventana si
        # dos solicitudes llegan a la vez; la UniqueConstraint de la tabla es
        # la última defensa. Se traduce al mismo 409 que ya usa el caso normal.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una solicitud pendiente")
    db.refresh(request)
    notification_service.notify_users(
        db, [to_user.id], "Nueva solicitud de amistad",
        f"{from_user.display_name} (@{from_user.username}) quiere ser tu amigo en FishDex.",
        {"type": "friend_request"},
    )
    return request


def _get_pending_request_or_404(db: Session, request_id: int, to_user_id: int) -> FriendRequest:
    request = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.id == request_id,
            FriendRequest.to_user_id == to_user_id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .first()
    )
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    return request


def accept_friend_request(db: Session, current_user: User, request_id: int) -> None:
    request = _get_pending_request_or_404(db, request_id, current_user.id)
    request.status = FriendRequestStatus.ACCEPTED
    db.add(Friend(user_id=request.from_user_id, friend_id=request.to_user_id))
    db.add(Friend(user_id=request.to_user_id, friend_id=request.from_user_id))
    try:
        db.flush()
        achievement_service.evaluate_achievements(db, request.from_user_id)
        achievement_service.evaluate_achievements(db, request.to_user_id)
        db.commit()
    except IntegrityError:
        # Ya se había aceptado (y creado la amistad) desde una petición
        # concurrente: el estado final deseado ya existe, así que se trata
        # como no-op idempotente en vez de un error. El rollback también
        # deshace el cambio de estado de la solicitud: se vuelve a marcar como
        # aceptada para que no se quede para siempre en "pendientes".
        db.rollback()
        db.query(FriendRequest).filter(
            FriendRequest.id == request_id, FriendRequest.status == FriendRequestStatus.PENDING
        ).update({FriendRequest.status: FriendRequestStatus.ACCEPTED}, synchronize_session=False)
        db.commit()
        return
    notification_service.notify_users(
        db, [request.from_user_id], "Solicitud aceptada",
        f"{current_user.display_name} ha aceptado tu solicitud de amistad.",
        {"type": "friend_accepted", "user_id": current_user.id},
    )


def reject_friend_request(db: Session, current_user: User, request_id: int) -> None:
    request = _get_pending_request_or_404(db, request_id, current_user.id)
    request.status = FriendRequestStatus.REJECTED
    db.commit()


def remove_friend(db: Session, current_user: User, friend_user_id: int) -> None:
    db.query(Friend).filter(
        or_(
            (Friend.user_id == current_user.id) & (Friend.friend_id == friend_user_id),
            (Friend.user_id == friend_user_id) & (Friend.friend_id == current_user.id),
        )
    ).delete(synchronize_session=False)
    db.commit()


def list_friends(db: Session, user_id: int) -> list[User]:
    rows = db.query(Friend).filter(Friend.user_id == user_id).all()
    friend_ids = [row.friend_id for row in rows]
    if not friend_ids:
        return []
    return db.query(User).filter(User.id.in_(friend_ids)).all()


def list_pending_requests(db: Session, user_id: int) -> list[FriendRequest]:
    return (
        db.query(FriendRequest)
        .filter(FriendRequest.to_user_id == user_id, FriendRequest.status == FriendRequestStatus.PENDING)
        .all()
    )


def species_discovered_count(db: Session, user_id: int) -> int:
    return db.query(Capture.fish_species_id).filter(Capture.user_id == user_id).distinct().count()


def rare_plus_species_count(db: Session, user_id: int, rarities: set[Rarity] = RARE_PLUS) -> int:
    return (
        db.query(Capture.fish_species_id)
        .join(FishSpecies, FishSpecies.id == Capture.fish_species_id)
        .filter(Capture.user_id == user_id, FishSpecies.rarity.in_([r.value for r in rarities]))
        .distinct()
        .count()
    )


def species_discovered_counts(db: Session, user_ids: list[int]) -> dict[int, int]:
    """Versión agregada de `species_discovered_count` para varios usuarios a
    la vez: una sola consulta con GROUP BY en vez de 1 consulta por amigo
    (evita el N+1 al listar `GET /friends`)."""
    if not user_ids:
        return {}
    rows = (
        db.query(Capture.user_id, func.count(func.distinct(Capture.fish_species_id)))
        .filter(Capture.user_id.in_(user_ids))
        .group_by(Capture.user_id)
        .all()
    )
    return {user_id: count for user_id, count in rows}


def rare_plus_species_counts(
    db: Session, user_ids: list[int], rarities: set[Rarity] = RARE_PLUS
) -> dict[int, int]:
    """Versión agregada de `rare_plus_species_count` para varios usuarios a la vez."""
    if not user_ids:
        return {}
    rows = (
        db.query(Capture.user_id, func.count(func.distinct(Capture.fish_species_id)))
        .join(FishSpecies, FishSpecies.id == Capture.fish_species_id)
        .filter(Capture.user_id.in_(user_ids), FishSpecies.rarity.in_([r.value for r in rarities]))
        .group_by(Capture.user_id)
        .all()
    )
    return {user_id: count for user_id, count in rows}


def assert_friendship_or_self(db: Session, current_user: User, target_user_id: int) -> None:
    if current_user.id == target_user_id:
        return
    if not _are_friends(db, current_user.id, target_user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puedes ver la FishDex de tus amigos")
