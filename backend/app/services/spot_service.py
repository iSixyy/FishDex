"""Spots de pesca guardados.

Privacidad: un spot solo lo ve su dueño y los amigos con los que lo ha
compartido uno a uno. Compartir exige amistad vigente: si se deshace la
amistad, el spot deja de verse aunque la fila de `spot_shares` siga ahí.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.friend import Friend
from app.models.spot import Spot, SpotPhoto, SpotShare
from app.models.user import User
from app.services import achievement_service
from app.services.image_service import delete_capture_image, save_capture_image

MAX_PHOTOS_PER_SPOT = 10


def _friend_ids(db: Session, user_id: int) -> set[int]:
    return {row[0] for row in db.query(Friend.friend_id).filter(Friend.user_id == user_id).all()}


def list_visible_spots(db: Session, user: User) -> list[Spot]:
    own = db.query(Spot).filter(Spot.user_id == user.id).all()
    friend_ids = _friend_ids(db, user.id)
    shared = []
    if friend_ids:
        shared = (
            db.query(Spot)
            .join(SpotShare, SpotShare.spot_id == Spot.id)
            .filter(SpotShare.user_id == user.id, Spot.user_id.in_(friend_ids))
            .all()
        )
    return sorted([*own, *shared], key=lambda s: s.id, reverse=True)


def get_visible_spot_or_404(db: Session, user: User, spot_id: int) -> Spot:
    spot = db.query(Spot).filter(Spot.id == spot_id).first()
    if spot is not None and spot.user_id == user.id:
        return spot
    if spot is not None and spot.user_id in _friend_ids(db, user.id):
        if any(share.user_id == user.id for share in spot.shares):
            return spot
    # Mismo 404 exista o no: no se revela la existencia de spots ajenos.
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Spot no encontrado")


def get_own_spot_or_404(db: Session, user: User, spot_id: int) -> Spot:
    spot = db.query(Spot).filter(Spot.id == spot_id, Spot.user_id == user.id).first()
    if spot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Spot no encontrado")
    return spot


def create_spot(db: Session, user: User, *, name: str, notes: str | None, latitude: float, longitude: float) -> Spot:
    spot = Spot(user_id=user.id, name=name.strip(), notes=notes, latitude=latitude, longitude=longitude)
    db.add(spot)
    db.flush()
    achievement_service.evaluate_achievements(db, user.id)
    db.commit()
    db.refresh(spot)
    return spot


def update_spot(db: Session, user: User, spot_id: int, changes: dict) -> Spot:
    spot = get_own_spot_or_404(db, user, spot_id)
    for field, value in changes.items():
        setattr(spot, field, value.strip() if field == "name" and isinstance(value, str) else value)
    db.commit()
    db.refresh(spot)
    return spot


def delete_spot(db: Session, user: User, spot_id: int) -> None:
    spot = get_own_spot_or_404(db, user, spot_id)
    paths = [p for photo in spot.photos for p in (photo.image_path, photo.thumbnail_path)]
    db.delete(spot)
    db.commit()
    delete_capture_image(*paths)


def set_shares(db: Session, user: User, spot_id: int, friend_ids: list[int]) -> Spot:
    spot = get_own_spot_or_404(db, user, spot_id)
    allowed = _friend_ids(db, user.id)
    invalid = set(friend_ids) - allowed
    if invalid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo puedes compartir spots con tus amigos")
    spot.shares.clear()
    db.flush()
    for friend_id in dict.fromkeys(friend_ids):
        spot.shares.append(SpotShare(user_id=friend_id))
    db.commit()
    db.refresh(spot)
    return spot


def add_photo(db: Session, user: User, spot_id: int, raw: bytes) -> Spot:
    spot = get_own_spot_or_404(db, user, spot_id)
    if len(spot.photos) >= MAX_PHOTOS_PER_SPOT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Máximo {MAX_PHOTOS_PER_SPOT} fotos por spot")
    from app.services.capture_service import _save_capture_image_or_400

    image_path, thumb_path = _save_capture_image_or_400(raw)
    spot.photos.append(SpotPhoto(image_path=image_path, thumbnail_path=thumb_path))
    db.commit()
    db.refresh(spot)
    return spot


def delete_photo(db: Session, user: User, spot_id: int, photo_id: int) -> Spot:
    spot = get_own_spot_or_404(db, user, spot_id)
    photo = next((p for p in spot.photos if p.id == photo_id), None)
    if photo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foto no encontrada")
    paths = (photo.image_path, photo.thumbnail_path)
    spot.photos.remove(photo)
    db.commit()
    delete_capture_image(*paths)
    db.refresh(spot)
    return spot
