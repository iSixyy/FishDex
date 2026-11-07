"""Orquesta el registro de una captura: valida, calcula ELO en servidor,
detecta récords personales, guarda la imagen, comprueba logros y elige la
frase de celebración. Es el corazón de la Fase 4/5/10 del proyecto."""
import json

from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.capture import Capture
from app.models.elo_history import EloHistory
from app.models.fish_species import FishSpecies
from app.models.friend import Friend
from app.models.social import CaptureComment, CaptureLike
from app.models.user import User
from app.schemas.capture import CaptureCreate, CaptureResult, CapturePublic, CaptureUpdate, PersonalRecordInfo
from app.services import achievement_service, notification_service, weather_service
from app.services.elo_service import calculate_capture_elo, rank_name_for_elo, recalculate_user_elo
from app.services.image_service import delete_capture_image, save_capture_image, to_public_url
from app.services.location_service import resolve_location_name
from app.services.quote_service import get_celebration_quote

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB


def _weather(capture: Capture) -> dict | None:
    if not capture.weather_json:
        return None
    try:
        return json.loads(capture.weather_json)
    except ValueError:
        return None


def capture_to_public(capture: Capture) -> CapturePublic:
    species = capture.species
    return CapturePublic(
        id=capture.id,
        fish_species_id=capture.fish_species_id,
        fish_species_name=species.name,
        rarity=species.rarity,
        image_url=to_public_url(capture.image_path),
        thumbnail_url=to_public_url(capture.thumbnail_path),
        weight_kg=capture.weight_kg,
        length_cm=capture.length_cm,
        latitude=capture.latitude,
        longitude=capture.longitude,
        location_name=capture.location_name,
        bait_technique=capture.bait_technique,
        captured_at=capture.captured_at,
        elo_earned=capture.elo_earned,
        is_new_species=capture.is_new_species,
        is_personal_record_weight=capture.is_personal_record_weight,
        is_personal_record_length=capture.is_personal_record_length,
        weather=_weather(capture),
    )


def _get_species_or_404(db: Session, species_id: int) -> FishSpecies:
    species = db.query(FishSpecies).filter(FishSpecies.id == species_id).first()
    if species is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Especie no encontrada")
    return species


def _personal_best(db: Session, user_id: int, species_id: int) -> tuple[float | None, float | None]:
    row = (
        db.query(func.max(Capture.weight_kg), func.max(Capture.length_cm))
        .filter(Capture.user_id == user_id, Capture.fish_species_id == species_id)
        .first()
    )
    if row is None:
        return None, None
    return row[0], row[1]


def _find_by_client_id(db: Session, user_id: int, client_id: str | None) -> Capture | None:
    if not client_id:
        return None
    return db.query(Capture).filter(Capture.user_id == user_id, Capture.client_id == client_id).first()


async def read_capture_image(image: UploadFile | None) -> bytes | None:
    """Lee el UploadFile por trozos y aborta en cuanto se supera el límite,
    en vez de cargar el fichero entero en memoria antes de comprobarlo.
    Es la única parte asíncrona del registro: el resto (Pillow, SQLAlchemy,
    Ollama) es bloqueante y se ejecuta fuera del event loop."""
    if image is None:
        return None
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El fichero debe ser una imagen")
    chunks: list[bytes] = []
    total = 0
    while chunk := await image.read(64 * 1024):
        total += len(chunk)
        if total > MAX_IMAGE_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "La imagen supera el tamaño máximo permitido")
        chunks.append(chunk)
    return b"".join(chunks) or None


def _save_capture_image_or_400(raw: bytes) -> tuple[str, str]:
    """Envuelve save_capture_image: un fichero corrupto o que no sea una
    imagen real debe devolver 400, no un 500 sin controlar."""
    try:
        return save_capture_image(raw)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        # `DecompressionBombError` hereda de `Exception`, no de `OSError` (una
        # imagen "bomba": muy comprimida pero con dimensiones enormes, dentro
        # del límite de tamaño en bytes), así que necesita su propio except o
        # se cuela como 500 sin controlar.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La imagen no es válida")


def _existing_capture_result(db: Session, user: User, capture: Capture) -> CaptureResult:
    """Respuesta para un reintento de una captura ya registrada (mismo
    `client_id`): se devuelve la captura original sin volver a sumar ELO."""
    db.refresh(user)
    species = capture.species
    is_record = (capture.is_personal_record_weight or capture.is_personal_record_length) and not capture.is_new_species
    quote = get_celebration_quote(
        db,
        species_name=species.name,
        is_new_species=capture.is_new_species,
        is_personal_record=is_record,
        rarity=species.rarity,
        weight_kg=capture.weight_kg,
        species_max_weight_kg=species.max_weight_kg,
    )
    return CaptureResult(
        capture=capture_to_public(capture),
        elo_earned=capture.elo_earned,
        total_elo=user.elo,
        rank=rank_name_for_elo(user.elo),
        is_new_species=capture.is_new_species,
        record=PersonalRecordInfo(
            previous_weight_kg=None,
            previous_length_cm=None,
            new_weight_kg=capture.weight_kg,
            new_length_cm=capture.length_cm,
            is_new_record=is_record,
        ),
        quote=quote,
        new_achievements=[],
    )


def create_capture(db: Session, user: User, payload: CaptureCreate, raw_image: bytes | None) -> CaptureResult:
    """Parte síncrona (bloqueante) del registro. La ruta la ejecuta en un
    threadpool para no congelar el event loop mientras Pillow procesa la
    foto u Ollama genera la frase (hasta varios segundos)."""
    existing = _find_by_client_id(db, user.id, payload.client_id)
    if existing is not None:
        return _existing_capture_result(db, user, existing)

    species = _get_species_or_404(db, payload.fish_species_id)

    was_discovered_before = (
        db.query(Capture)
        .filter(Capture.user_id == user.id, Capture.fish_species_id == species.id)
        .first()
        is not None
    )
    is_new_species = not was_discovered_before

    previous_weight, previous_length = _personal_best(db, user.id, species.id)
    is_record_weight = previous_weight is None or payload.weight_kg > previous_weight
    is_record_length = previous_length is None or payload.length_cm > previous_length
    is_personal_record = is_record_weight or is_record_length

    image_path, thumb_path = None, None
    if raw_image:
        image_path, thumb_path = _save_capture_image_or_400(raw_image)

    # Instantánea de clima/mar/luna (mejor esfuerzo, timeout corto). Se pide
    # antes de abrir la escritura para no alargar la transacción.
    conditions = None
    if payload.latitude is not None and payload.longitude is not None:
        conditions = weather_service.get_conditions(payload.latitude, payload.longitude)

    try:
        location_name, autonomous_community = resolve_location_name(db, payload.latitude, payload.longitude)
        final_location_name = payload.location_name or location_name

        breakdown = calculate_capture_elo(
            db,
            user_id=user.id,
            species=species,
            weight_kg=payload.weight_kg,
            length_cm=payload.length_cm,
            is_new_species=is_new_species,
            is_personal_record=is_personal_record,
            captured_at=payload.captured_at,
        )

        capture = Capture(
            user_id=user.id,
            fish_species_id=species.id,
            image_path=image_path,
            thumbnail_path=thumb_path,
            weight_kg=payload.weight_kg,
            length_cm=payload.length_cm,
            latitude=payload.latitude,
            longitude=payload.longitude,
            location_name=final_location_name,
            autonomous_community=autonomous_community,
            bait_technique=payload.bait_technique,
            client_id=payload.client_id,
            weather_json=json.dumps(conditions) if conditions else None,
            captured_at=payload.captured_at,
            elo_earned=breakdown.total,
            is_new_species=is_new_species,
            is_personal_record_weight=is_record_weight,
            is_personal_record_length=is_record_length,
        )
        db.add(capture)
        db.flush()  # asigna capture.id sin cerrar la transacción

        if breakdown.total > 0:
            # UPDATE atómico a nivel de columna (`elo = elo + total`) en vez de
            # `user.elo += breakdown.total`, que es un lee-modifica-escribe en
            # memoria: dos capturas simultáneas del mismo usuario (probable al
            # vaciar la cola offline) perderían un incremento (lost update).
            db.query(User).filter(User.id == user.id).update(
                {User.elo: User.elo + breakdown.total}, synchronize_session="fetch"
            )
            db.add(EloHistory(user_id=user.id, capture_id=capture.id, amount=breakdown.total, reason="capture"))

        new_achievements = achievement_service.evaluate_achievements(db, user.id)

        db.commit()
    except IntegrityError:
        # Dos envíos simultáneos con el mismo `client_id` (un reintento que se
        # cruza con la petición original): gana el primero en confirmar y
        # este devuelve la captura ya guardada en vez de un 500.
        db.rollback()
        delete_capture_image(image_path, thumb_path)
        existing = _find_by_client_id(db, user.id, payload.client_id)
        if existing is None:
            raise
        return _existing_capture_result(db, user, existing)
    except Exception:
        db.rollback()
        delete_capture_image(image_path, thumb_path)
        raise

    db.refresh(capture)
    db.refresh(user)

    if is_record_weight:
        _notify_overtaken_friends(db, user, species, previous_weight, payload.weight_kg)

    quote = get_celebration_quote(
        db,
        species_name=species.name,
        is_new_species=is_new_species,
        is_personal_record=is_personal_record and not is_new_species,
        rarity=species.rarity,
        weight_kg=payload.weight_kg,
        species_max_weight_kg=species.max_weight_kg,
    )

    return CaptureResult(
        capture=capture_to_public(capture),
        elo_earned=breakdown.total,
        total_elo=user.elo,
        rank=rank_name_for_elo(user.elo),
        is_new_species=is_new_species,
        record=PersonalRecordInfo(
            previous_weight_kg=previous_weight,
            previous_length_cm=previous_length,
            new_weight_kg=payload.weight_kg,
            new_length_cm=payload.length_cm,
            # Intencional: en la primera captura de una especie no se marca como
            # "récord" para no duplicar el mensaje con la celebración de especie
            # nueva, que ya muestra "ESPECIE DESBLOQUEADA".
            is_new_record=is_personal_record and not is_new_species,
        ),
        quote=quote,
        new_achievements=[a.name for a in new_achievements],
    )


def _notify_overtaken_friends(
    db: Session, user: User, species: FishSpecies, previous_best: float | None, new_weight: float
) -> None:
    """Avisa a los amigos cuyo récord de peso en esta especie acaba de quedar
    por debajo del de `user` (y que antes no lo estaba)."""
    friend_ids = [row[0] for row in db.query(Friend.friend_id).filter(Friend.user_id == user.id).all()]
    if not friend_ids:
        return
    rows = (
        db.query(Capture.user_id, func.max(Capture.weight_kg))
        .filter(Capture.user_id.in_(friend_ids), Capture.fish_species_id == species.id)
        .group_by(Capture.user_id)
        .all()
    )
    overtaken = [
        friend_id
        for friend_id, friend_best in rows
        if friend_best < new_weight and (previous_best is None or previous_best <= friend_best)
    ]
    if overtaken:
        weight_label = f"{new_weight:.2f}".replace(".", ",")
        notification_service.notify_users(
            db,
            overtaken,
            "¡Te han superado!",
            f"{user.display_name} ha superado tu récord de {species.name} con {weight_label} kg",
            {"type": "record_overtaken", "species_id": species.id},
        )


def _get_own_capture_or_404(db: Session, user: User, capture_id: int) -> Capture:
    capture = db.query(Capture).filter(Capture.id == capture_id, Capture.user_id == user.id).first()
    if capture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Captura no encontrada")
    return capture


def update_capture(db: Session, user: User, capture_id: int, patch: CaptureUpdate) -> CapturePublic:
    """Corrige especie/peso/longitud/cebo/lugar y recalcula el ELO de todo el
    historial del usuario (ver `recalculate_user_elo`)."""
    capture = _get_own_capture_or_404(db, user, capture_id)
    changes = patch.model_dump(exclude_unset=True)
    if "fish_species_id" in changes:
        capture.fish_species_id = _get_species_or_404(db, changes.pop("fish_species_id")).id
    for field, value in changes.items():
        setattr(capture, field, value)
    db.flush()
    db.expire(capture, ["species"])
    recalculate_user_elo(db, user.id)
    achievement_service.evaluate_achievements(db, user.id)
    db.commit()
    db.refresh(capture)
    return capture_to_public(capture)


def delete_capture(db: Session, user: User, capture_id: int) -> None:
    """Borra una captura propia (con sus likes, comentarios y fotos) y
    recalcula el ELO. El historial de ELO se conserva, desvinculado."""
    capture = _get_own_capture_or_404(db, user, capture_id)
    image_path, thumb_path = capture.image_path, capture.thumbnail_path
    db.query(EloHistory).filter(EloHistory.capture_id == capture.id).update(
        {EloHistory.capture_id: None}, synchronize_session=False
    )
    db.query(CaptureLike).filter(CaptureLike.capture_id == capture.id).delete(synchronize_session=False)
    db.query(CaptureComment).filter(CaptureComment.capture_id == capture.id).delete(synchronize_session=False)
    db.delete(capture)
    db.flush()
    recalculate_user_elo(db, user.id)
    db.commit()
    delete_capture_image(image_path, thumb_path)
