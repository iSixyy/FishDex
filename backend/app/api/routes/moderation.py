from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import limiter, user_or_ip
from app.database import get_db
from app.models.user import User
from app.schemas.account import ReportCreate, ReportPublic
from app.schemas.user import UserPublic
from app.services import moderation_service
from app.services.user_service import to_user_public

router = APIRouter(tags=["moderation"])


@router.get("/users/me/blocked", response_model=list[UserPublic])
def list_blocked(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[UserPublic]:
    return [to_user_public(u) for u in moderation_service.list_blocked(db, user)]


@router.post("/users/{user_id}/block", status_code=204)
def block_user(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Deja de ser amigos, cancela solicitudes y spots compartidos, y ninguno
    de los dos puede volver a pedir amistad al otro ni ver sus comentarios."""
    moderation_service.block_user(db, user, user_id)


@router.delete("/users/{user_id}/block", status_code=204)
def unblock_user(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    moderation_service.unblock_user(db, user, user_id)


@router.post("/reports", response_model=ReportPublic, status_code=201)
@limiter.limit("20/hour", key_func=user_or_ip)
def create_report(
    request: Request, payload: ReportCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ReportPublic:
    report = moderation_service.create_report(
        db, user, target_type=payload.target_type, target_id=payload.target_id,
        reason=payload.reason, details=payload.details,
    )
    return ReportPublic.model_validate(report)


@router.get("/reports", response_model=list[ReportPublic])
def list_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ReportPublic]:
    """Reportes pendientes de revisar (solo administración)."""
    return [ReportPublic.model_validate(r) for r in moderation_service.list_open_reports(db, user)]


@router.post("/reports/{report_id}/resolve", status_code=204)
def resolve_report(report_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    moderation_service.resolve_report(db, user, report_id)
