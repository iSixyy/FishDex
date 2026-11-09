"""Recordatorios de caducidad de la licencia de pesca (push)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.game_config import GAME_TIMEZONE
from app.models.user import User
from app.services import notification_service

# (etapa, días que faltan como máximo, texto), de la más urgente a la menos.
_STAGES = [
    (3, 0, "Tu licencia de pesca{region} {expired}. Renuévala antes de volver a pescar."),
    (2, 7, "Tu licencia de pesca{region} caduca en {days}."),
    (1, 30, "Tu licencia de pesca{region} caduca en {days}. ¡Que no te pille el guarda!"),
]


def _days_label(days: int) -> str:
    return "1 día" if days == 1 else f"{days} días"


def _stage_for(days_left: int) -> tuple[int, str] | None:
    for stage, max_days, text in _STAGES:
        if days_left <= max_days:
            return stage, text
    return None


def send_reminders(db: Session, today: date | None = None) -> int:
    """Avisa a 30 días, a 7 días y el día que caduca (una vez cada aviso).
    Devuelve cuántos avisos ha enviado."""
    today = today or datetime.now(ZoneInfo(GAME_TIMEZONE)).date()
    sent = 0
    users = db.query(User).filter(User.license_expires_on.isnot(None), User.license_reminder_stage < 3).all()
    for user in users:
        days_left = (user.license_expires_on - today).days
        found = _stage_for(days_left)
        if found is None or found[0] <= user.license_reminder_stage:
            continue
        stage, text = found
        # UPDATE condicional: con varios workers solo uno envía cada aviso.
        claimed = (
            db.query(User)
            .filter(User.id == user.id, User.license_reminder_stage < stage)
            .update({User.license_reminder_stage: stage}, synchronize_session=False)
        )
        db.commit()
        if not claimed:
            continue
        region = f" ({user.license_region})" if user.license_region else ""
        notification_service.notify_users(
            db, [user.id], "Licencia de pesca", text.format(
                region=region,
                days=_days_label(max(days_left, 0)),
                # El último día aún es válida: "caduca hoy", no "ha caducado".
                expired="caduca hoy" if days_left == 0 else "ha caducado",
            ),
            {"type": "license"},
        )
        sent += 1
    return sent
