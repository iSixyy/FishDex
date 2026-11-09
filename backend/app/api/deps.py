from datetime import timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token_claims
from app.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _issued_after_account_creation(issued_at: int | None, user: User) -> bool:
    """SQLite reutiliza el id de la última cuenta borrada: sin esta
    comprobación, el token de una cuenta borrada servía para entrar en la
    siguiente que se registrara. Un token sin `iat` (emitido antes de este
    cambio) no se puede verificar y se rechaza: basta con volver a entrar."""
    if issued_at is None:
        return False
    created = user.created_at
    if created is None:
        return True
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    # `iat` va en segundos enteros: se compara con el segundo de creación.
    return issued_at >= int(created.timestamp())


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado")
    claims = decode_token_claims(credentials.credentials)
    if claims is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o caducado")
    user = db.query(User).filter(User.id == claims.user_id).first()
    if user is None or not _issued_after_account_creation(claims.issued_at, user):
        # Mismo mensaje en ambos casos: el token es de una cuenta que ya no
        # existe (aunque otra haya heredado su id).
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no encontrado")
    if claims.token_version != (user.token_version or 0):
        # Sesión cerrada (logout) después de emitir este token.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión se ha cerrado")
    return user
