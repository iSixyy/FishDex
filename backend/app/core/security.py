"""Hashing de contraseñas y JWT."""
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    # bcrypt exige truncar a 72 BYTES (no caracteres): un carácter multibyte
    # cortado a medias generaría un hash distinto en cada intento de verificación.
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: int, token_version: int = 0) -> str:
    """`ver` es la versión de sesión del usuario (`User.token_version`): al
    cerrar sesión se incrementa y todos los tokens emitidos antes dejan de
    valer, en vez de seguir funcionando hasta que caduquen (7 días)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_expire_minutes)
    # `iat` permite rechazar tokens emitidos ANTES de crearse la cuenta: SQLite
    # reutiliza el id de un usuario borrado, y sin esto el token de la cuenta
    # borrada valía para la siguiente que se registrara con ese id.
    payload = {"sub": str(subject), "ver": token_version, "iat": int(now.timestamp()), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


class TokenClaims(NamedTuple):
    user_id: int
    token_version: int
    issued_at: int | None  # segundos UNIX; None en tokens antiguos sin `iat`


def decode_token_claims(token: str) -> TokenClaims | None:
    """Claims de un token válido, o None. Los tokens emitidos antes de existir
    `ver` cuentan como versión 0."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        issued_at = payload.get("iat")
        return TokenClaims(int(user_id), int(payload.get("ver", 0)), int(issued_at) if issued_at is not None else None)
    except (JWTError, ValueError, TypeError):
        return None


def decode_access_token(token: str) -> int | None:
    claims = decode_token_claims(token)
    return claims[0] if claims else None
