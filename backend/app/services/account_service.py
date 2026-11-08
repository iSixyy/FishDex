"""Gestión de la cuenta: perfil, avatar, contraseña, licencia y baja.

Borrar la cuenta desde la app es obligatorio para publicar en Google Play y
en la App Store: se eliminan TODOS los datos del usuario (capturas y fotos,
amistades, comentarios, spots...), no solo se desactiva.
"""
import hashlib
import hmac
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.capture import Capture
from app.models.challenge import Challenge, ChallengeParticipant
from app.models.device import DeviceToken
from app.models.fish_species import FishSpecies
from app.models.friend import Friend, FriendRequest
from app.models.moderation import Report, ReportTarget, UserBlock
from app.models.season import SeasonAward
from app.models.social import CaptureComment, CaptureLike
from app.models.spot import Spot, SpotShare
from app.models.user import User
from app.services import email_service
from app.services.image_service import delete_capture_image, save_avatar_image

PASSWORD_RESET_TTL = timedelta(minutes=15)
PASSWORD_RESET_MAX_ATTEMPTS = 5


# ---------------------------------------------------------------- perfil
def update_profile(db: Session, user: User, *, display_name: str | None) -> User:
    if display_name is not None:
        user.display_name = display_name
    db.commit()
    db.refresh(user)
    return user


def set_avatar(db: Session, user: User, raw: bytes) -> User:
    try:
        new_path = save_avatar_image(raw)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La imagen no es válida")
    old_path = user.avatar
    user.avatar = new_path
    db.commit()
    db.refresh(user)
    if old_path and not old_path.startswith(("http://", "https://", "/")):
        delete_capture_image(old_path)
    return user


def remove_avatar(db: Session, user: User) -> User:
    old_path = user.avatar
    user.avatar = None
    db.commit()
    db.refresh(user)
    if old_path and not old_path.startswith(("http://", "https://", "/")):
        delete_capture_image(old_path)
    return user


# ---------------------------------------------------------------- contraseña
def change_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual no es correcta")
    user.password_hash = hash_password(new_password)
    # Cierra las demás sesiones: si alguien conocía la contraseña antigua, fuera.
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    db.refresh(user)
    return user


def _code_digest(code: str) -> str:
    key = get_settings().jwt_secret_key.encode("utf-8")
    return hmac.new(key, code.encode("utf-8"), hashlib.sha256).hexdigest()


def request_password_reset(db: Session, email: str) -> None:
    """Envía un código de 6 cifras por correo. No revela si el email existe:
    la respuesta es la misma en ambos casos."""
    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if user is None:
        return
    code = f"{secrets.randbelow(1_000_000):06d}"
    user.password_reset_code_hash = _code_digest(code)
    user.password_reset_expires_at = datetime.now(timezone.utc) + PASSWORD_RESET_TTL
    user.password_reset_attempts = 0
    db.commit()
    email_service.send_email(
        user.email,
        "Tu código para recuperar la contraseña de FishDex",
        f"Hola, {user.display_name}:\n\n"
        f"Tu código es {code}. Caduca en {int(PASSWORD_RESET_TTL.total_seconds() // 60)} minutos.\n\n"
        "Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.",
    )


def reset_password(db: Session, email: str, code: str, new_password: str) -> User:
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "El código no es válido o ha caducado")
    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if user is None or not user.password_reset_code_hash or user.password_reset_expires_at is None:
        raise invalid
    expires = user.password_reset_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc) or user.password_reset_attempts >= PASSWORD_RESET_MAX_ATTEMPTS:
        raise invalid
    if not hmac.compare_digest(user.password_reset_code_hash, _code_digest(code.strip())):
        user.password_reset_attempts += 1
        db.commit()
        raise invalid
    user.password_hash = hash_password(new_password)
    user.password_reset_code_hash = None
    user.password_reset_expires_at = None
    user.password_reset_attempts = 0
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------- licencia
def set_license(db: Session, user: User, *, expires_on: date | None, region: str | None) -> User:
    user.license_expires_on = expires_on
    user.license_region = region
    user.license_reminder_stage = 0  # fecha nueva: vuelven a enviarse los avisos
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------- baja
def delete_account(db: Session, user: User, password: str) -> None:
    if not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña no es correcta")
    uid = user.id
    capture_ids = [row[0] for row in db.query(Capture.id).filter(Capture.user_id == uid).all()]
    files = [p for row in db.query(Capture.image_path, Capture.thumbnail_path).filter(Capture.user_id == uid) for p in row]
    spots = db.query(Spot).filter(Spot.user_id == uid).all()
    files += [p for spot in spots for photo in spot.photos for p in (photo.image_path, photo.thumbnail_path)]
    if user.avatar:
        files.append(user.avatar)

    # Interacciones propias y sobre sus capturas.
    db.query(CaptureLike).filter(or_(CaptureLike.user_id == uid, CaptureLike.capture_id.in_(capture_ids))).delete(
        synchronize_session=False
    )
    comment_ids = [
        row[0]
        for row in db.query(CaptureComment.id).filter(
            or_(CaptureComment.user_id == uid, CaptureComment.capture_id.in_(capture_ids))
        )
    ]
    db.query(CaptureComment).filter(CaptureComment.id.in_(comment_ids)).delete(synchronize_session=False)

    # Relaciones sociales.
    db.query(Friend).filter(or_(Friend.user_id == uid, Friend.friend_id == uid)).delete(synchronize_session=False)
    db.query(FriendRequest).filter(or_(FriendRequest.from_user_id == uid, FriendRequest.to_user_id == uid)).delete(
        synchronize_session=False
    )
    db.query(UserBlock).filter(or_(UserBlock.blocker_id == uid, UserBlock.blocked_id == uid)).delete(
        synchronize_session=False
    )
    db.query(Report).filter(
        or_(
            Report.reporter_id == uid,
            (Report.target_type == ReportTarget.USER) & (Report.target_id == uid),
            (Report.target_type == ReportTarget.CAPTURE) & Report.target_id.in_(capture_ids),
            (Report.target_type == ReportTarget.COMMENT) & Report.target_id.in_(comment_ids),
        )
    ).delete(synchronize_session=False)

    # Retos: los que creó desaparecen; en los demás deja de participar.
    for challenge in db.query(Challenge).filter(Challenge.creator_id == uid).all():
        db.delete(challenge)
    db.flush()
    db.query(ChallengeParticipant).filter(ChallengeParticipant.user_id == uid).delete(synchronize_session=False)
    db.query(Challenge).filter(Challenge.winner_id == uid).update({Challenge.winner_id: None}, synchronize_session=False)

    # Spots (sus fotos y comparticiones caen en cascada) y spots compartidos con él.
    for spot in spots:
        db.delete(spot)
    db.query(SpotShare).filter(SpotShare.user_id == uid).delete(synchronize_session=False)

    db.query(DeviceToken).filter(DeviceToken.user_id == uid).delete(synchronize_session=False)
    db.query(SeasonAward).filter(SeasonAward.user_id == uid).delete(synchronize_session=False)
    # Las especies que añadió al catálogo común se quedan (son de todos).
    db.query(FishSpecies).filter(FishSpecies.created_by_id == uid).update(
        {FishSpecies.created_by_id: None}, synchronize_session=False
    )

    # Capturas, historial de ELO y logros caen en cascada desde el usuario.
    db.delete(user)
    db.commit()
    delete_capture_image(*files)
