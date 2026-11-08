"""Envío de correos (recuperar contraseña) por SMTP.

Sin `SMTP_HOST` configurado no se envía nada: el mensaje se escribe en el
log del servidor, suficiente para desarrollo. En producción hay que
configurar un servidor SMTP (ver SETUP.md)."""
import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger("fishdex.email")


def send_email(to: str, subject: str, body: str) -> bool:
    settings = get_settings()
    if not settings.smtp_host:
        logger.warning("SMTP no configurado. Correo para %s — %s:\n%s", to, subject, body)
        return False
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("No se pudo enviar el correo a %s", to)
        return False
