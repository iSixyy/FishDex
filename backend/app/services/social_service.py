"""Alta/baja de "me gusta" y comentarios sobre capturas.

Las reglas de visibilidad son las mismas que para ver la FishDex de un
amigo: solo se puede interactuar con una captura propia o de un amigo
(`friend_service.assert_friendship_or_self`).
"""
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.capture import Capture
from app.models.social import CaptureComment, CaptureLike
from app.models.user import User
from app.services import friend_service


def _get_capture_or_404(db: Session, capture_id: int) -> Capture:
    capture = db.query(Capture).filter(Capture.id == capture_id).first()
    if capture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Captura no encontrada")
    return capture


def _assert_can_interact(db: Session, current_user: User, capture: Capture) -> None:
    friend_service.assert_friendship_or_self(db, current_user, capture.user_id)


def like_capture(db: Session, current_user: User, capture_id: int) -> None:
    capture = _get_capture_or_404(db, capture_id)
    _assert_can_interact(db, current_user, capture)

    db.add(CaptureLike(capture_id=capture.id, user_id=current_user.id))
    try:
        db.commit()
    except IntegrityError:
        # Ya existía el like (UniqueConstraint capture_id+user_id): se trata
        # como no-op idempotente, igual que `friend_service.accept_friend_request`.
        db.rollback()


def unlike_capture(db: Session, current_user: User, capture_id: int) -> None:
    capture = _get_capture_or_404(db, capture_id)
    _assert_can_interact(db, current_user, capture)

    db.query(CaptureLike).filter(
        CaptureLike.capture_id == capture.id, CaptureLike.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()


def list_comments(db: Session, current_user: User, capture_id: int, limit: int, offset: int) -> list[CaptureComment]:
    capture = _get_capture_or_404(db, capture_id)
    _assert_can_interact(db, current_user, capture)

    return (
        db.query(CaptureComment)
        .filter(CaptureComment.capture_id == capture.id)
        .order_by(CaptureComment.created_at.asc())
        .limit(limit)
        .offset(offset)
        .all()
    )


def create_comment(db: Session, current_user: User, capture_id: int, text: str) -> CaptureComment:
    capture = _get_capture_or_404(db, capture_id)
    _assert_can_interact(db, current_user, capture)

    comment = CaptureComment(capture_id=capture.id, user_id=current_user.id, text=text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, current_user: User, comment_id: int) -> None:
    comment = db.query(CaptureComment).filter(CaptureComment.id == comment_id).first()
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comentario no encontrado")
    if comment.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puedes borrar tus propios comentarios")

    db.delete(comment)
    db.commit()
