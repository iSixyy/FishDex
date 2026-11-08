"""Hashing de contraseñas y JWT."""
from datetime import datetime, timedelta, timezone

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
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(subject), "ver": token_version, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token_claims(token: str) -> tuple[int, int] | None:
    """(user_id, versión de sesión) de un token válido, o None. Los tokens
    emitidos antes de existir `ver` cuentan como versión 0."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id), int(payload.get("ver", 0))
    except (JWTError, ValueError, TypeError):
        return None


def decode_access_token(token: str) -> int | None:
    claims = decode_token_claims(token)
    return claims[0] if claims else None
