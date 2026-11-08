"""Notificaciones push a través del servicio gratuito de Expo.

Las llamadas son "dispara y olvida": los tokens se leen en la transacción del
llamador y el envío HTTP se hace en un hilo aparte, así que una notificación
nunca retrasa ni rompe la petición que la origina. Si Expo responde que un
token ya no existe (app desinstalada), se borra de `device_tokens`.
"""
import logging
import threading

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models.device import DeviceToken

logger = logging.getLogger("fishdex.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_CHUNK_SIZE = 100  # máximo de mensajes por petición que admite Expo


def register_device(db: Session, user_id: int, token: str, platform: str | None) -> None:
    device = db.query(DeviceToken).filter(DeviceToken.token == token).first()
    if device is None:
        db.add(DeviceToken(user_id=user_id, token=token, platform=platform))
    else:
        device.user_id = user_id  # el móvil ha cambiado de cuenta
        device.platform = platform
    db.commit()


def unregister_device(db: Session, token: str) -> None:
    db.query(DeviceToken).filter(DeviceToken.token == token).delete(synchronize_session=False)
    db.commit()


def _deliver(messages: list[dict]) -> None:
    invalid: list[str] = []
    try:
        with httpx.Client(timeout=10.0) as client:
            for start in range(0, len(messages), _CHUNK_SIZE):
                chunk = messages[start : start + _CHUNK_SIZE]
                response = client.post(EXPO_PUSH_URL, json=chunk, headers={"Accept": "application/json"})
                tickets = response.json().get("data", []) if response.status_code == 200 else []
                for message, ticket in zip(chunk, tickets):
                    if ticket.get("details", {}).get("error") == "DeviceNotRegistered":
                        invalid.append(message["to"])
    except (httpx.HTTPError, ValueError, AttributeError) as exc:
        logger.warning("No se pudieron enviar notificaciones push: %s", exc)
    if invalid:
        db = SessionLocal()
        try:
            db.query(DeviceToken).filter(DeviceToken.token.in_(invalid)).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()


def notify_users(db: Session, user_ids: list[int] | set[int], title: str, body: str, data: dict | None = None) -> None:
    if not get_settings().push_enabled or not user_ids:
        return
    tokens = [row[0] for row in db.query(DeviceToken.token).filter(DeviceToken.user_id.in_(list(user_ids))).all()]
    _send(tokens, title, body, data)


def notify_everyone(db: Session, title: str, body: str, data: dict | None = None) -> None:
    """Para los eventos oficiales: a todos los dispositivos registrados."""
    if not get_settings().push_enabled:
        return
    tokens = [row[0] for row in db.query(DeviceToken.token).all()]
    _send(tokens, title, body, data)


def _send(tokens: list[str], title: str, body: str, data: dict | None) -> None:
    if not tokens:
        return
    messages = [
        {"to": token, "title": title, "body": body, "sound": "default", "data": data or {}}
        for token in tokens
    ]
    threading.Thread(target=_deliver, args=(messages,), daemon=True).start()
