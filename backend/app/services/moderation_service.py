"""Bloqueos y reportes de usuarios, capturas y comentarios."""
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.capture import Capture
from app.models.friend import Friend, FriendRequest, FriendRequestStatus
from app.models.moderation import Report, ReportStatus, ReportTarget, UserBlock
from app.models.social import CaptureComment
from app.models.spot import Spot, SpotShare
from app.models.user import User


def is_blocked_between(db: Session, user_a: int, user_b: int) -> bool:
    """True si cualquiera de los dos ha bloqueado al otro."""
    return (
        db.query(UserBlock.id)
        .filter(
            or_(
                (UserBlock.blocker_id == user_a) & (UserBlock.blocked_id == user_b),
                (UserBlock.blocker_id == user_b) & (UserBlock.blocked_id == user_a),
            )
        )
        .first()
        is not None
    )


def hidden_user_ids(db: Session, viewer_id: int) -> set[int]:
    """Usuarios cuyo contenido no debe ver `viewer` (bloqueados en cualquier sentido)."""
    rows = db.query(UserBlock.blocker_id, UserBlock.blocked_id).filter(
        or_(UserBlock.blocker_id == viewer_id, UserBlock.blocked_id == viewer_id)
    )
    return {blocked if blocker == viewer_id else blocker for blocker, blocked in rows}


def block_user(db: Session, me: User, target_id: int) -> None:
    if target_id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes bloquearte a ti mismo")
    if db.query(User.id).filter(User.id == target_id).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    pair = or_(
        (Friend.user_id == me.id) & (Friend.friend_id == target_id),
        (Friend.user_id == target_id) & (Friend.friend_id == me.id),
    )
    db.query(Friend).filter(pair).delete(synchronize_session=False)
    db.query(FriendRequest).filter(
        or_(
            (FriendRequest.from_user_id == me.id) & (FriendRequest.to_user_id == target_id),
            (FriendRequest.from_user_id == target_id) & (FriendRequest.to_user_id == me.id),
        ),
        FriendRequest.status == FriendRequestStatus.PENDING,
    ).update({FriendRequest.status: FriendRequestStatus.REJECTED}, synchronize_session=False)
    # Deja de compartir spots en ambos sentidos.
    for owner, guest in ((me.id, target_id), (target_id, me.id)):
        spot_ids = [row[0] for row in db.query(Spot.id).filter(Spot.user_id == owner)]
        if spot_ids:
            db.query(SpotShare).filter(SpotShare.spot_id.in_(spot_ids), SpotShare.user_id == guest).delete(
                synchronize_session=False
            )
    if db.query(UserBlock).filter(UserBlock.blocker_id == me.id, UserBlock.blocked_id == target_id).first() is None:
        db.add(UserBlock(blocker_id=me.id, blocked_id=target_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # bloqueo simultáneo: ya existe, que es lo que se quería


def unblock_user(db: Session, me: User, target_id: int) -> None:
    db.query(UserBlock).filter(UserBlock.blocker_id == me.id, UserBlock.blocked_id == target_id).delete(
        synchronize_session=False
    )
    db.commit()


def list_blocked(db: Session, me: User) -> list[User]:
    ids = [row[0] for row in db.query(UserBlock.blocked_id).filter(UserBlock.blocker_id == me.id)]
    if not ids:
        return []
    return db.query(User).filter(User.id.in_(ids)).order_by(User.display_name).all()


def _target_exists(db: Session, target_type: str, target_id: int) -> bool:
    model = {ReportTarget.USER: User, ReportTarget.CAPTURE: Capture, ReportTarget.COMMENT: CaptureComment}[target_type]
    return db.query(model.id).filter(model.id == target_id).first() is not None


def create_report(
    db: Session, reporter: User, *, target_type: str, target_id: int, reason: str, details: str | None
) -> Report:
    if not _target_exists(db, target_type, target_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No se ha encontrado lo que quieres reportar")
    existing = (
        db.query(Report)
        .filter(
            Report.reporter_id == reporter.id,
            Report.target_type == target_type,
            Report.target_id == target_id,
            Report.status == ReportStatus.OPEN,
        )
        .first()
    )
    if existing is not None:
        return existing  # ya lo había reportado: no se duplica
    report = Report(
        reporter_id=reporter.id, target_type=target_type, target_id=target_id, reason=reason, details=details
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_open_reports(db: Session, admin: User) -> list[Report]:
    if not admin.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo la administración puede revisar reportes")
    return db.query(Report).filter(Report.status == ReportStatus.OPEN).order_by(Report.created_at.asc()).all()


def resolve_report(db: Session, admin: User, report_id: int) -> None:
    if not admin.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo la administración puede revisar reportes")
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reporte no encontrado")
    report.status = ReportStatus.RESOLVED
    db.commit()
