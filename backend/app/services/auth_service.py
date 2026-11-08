from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest

_DUPLICATE_MESSAGE = "Ese nombre de usuario o email ya está en uso"


def register_user(db: Session, payload: RegisterRequest) -> User:
    # Email y usuario se comparan SIN distinguir mayúsculas: "Samuel" y
    # "samuel" son la misma cuenta (ver los índices de `app/models/user.py`).
    email = payload.email.strip().lower()
    exists = (
        db.query(User)
        .filter(or_(func.lower(User.username) == payload.username.lower(), func.lower(User.email) == email))
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_MESSAGE)

    user = User(
        username=payload.username,
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        elo=0,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Dos registros simultáneos con el mismo usuario/email: el índice
        # único es la última defensa; se traduce al mismo 409.
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_DUPLICATE_MESSAGE)
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
    user = db.query(User).filter(func.lower(User.email) == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )
    return user


def build_token(user: User) -> str:
    return create_access_token(subject=user.id, token_version=user.token_version or 0)


def revoke_sessions(db: Session, user: User) -> None:
    """Cierra todas las sesiones del usuario: los tokens emitidos hasta ahora
    llevan la versión anterior y `get_current_user` los rechazará."""
    db.query(User).filter(User.id == user.id).update(
        {User.token_version: User.token_version + 1}, synchronize_session=False
    )
    db.commit()
