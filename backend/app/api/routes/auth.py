from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.user import User
from app.schemas.account import PasswordChange, PasswordForgot, PasswordReset
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services import account_service, auth_service, user_service

router = APIRouter(prefix="/auth", tags=["auth"])


# El límite es por IP. Con "3/hour" bastaba con que tres personas detrás de la
# misma IP (CGNAT de una operadora móvil, una WiFi compartida o un proxy
# inverso sin `TRUST_PROXY_HEADERS`) se registraran para bloquear al resto.
@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("10/hour")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.register_user(db, payload)
    token = auth_service.build_token(user)
    return TokenResponse(access_token=token, user=user_service.to_user_public(user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate_user(db, payload)
    token = auth_service.build_token(user)
    return TokenResponse(access_token=token, user=user_service.to_user_public(user))


@router.post("/logout", status_code=204)
def logout(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Invalida en el servidor todos los tokens de la cuenta (no solo el de
    este móvil): antes un token robado o de un móvil perdido seguía valiendo
    hasta caducar, aunque se cerrara sesión."""
    auth_service.revoke_sessions(db, user)


@router.post("/password/change", response_model=TokenResponse)
def change_password(
    payload: PasswordChange, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> TokenResponse:
    """Cambia la contraseña y cierra las demás sesiones. Devuelve un token
    nuevo para que este dispositivo siga dentro."""
    user = account_service.change_password(db, user, payload.current_password, payload.new_password)
    return TokenResponse(access_token=auth_service.build_token(user), user=user_service.to_user_public(user))


@router.post("/password/forgot", status_code=204)
@limiter.limit("5/hour")
def forgot_password(request: Request, payload: PasswordForgot, db: Session = Depends(get_db)) -> None:
    """Envía un código de 6 cifras al correo. Responde igual exista o no la
    cuenta, para no revelar qué emails están registrados."""
    account_service.request_password_reset(db, payload.email)


@router.post("/password/reset", response_model=TokenResponse)
@limiter.limit("10/hour")
def reset_password(request: Request, payload: PasswordReset, db: Session = Depends(get_db)) -> TokenResponse:
    """Pone una contraseña nueva con el código recibido e inicia sesión."""
    user = account_service.reset_password(db, payload.email, payload.code, payload.new_password)
    return TokenResponse(access_token=auth_service.build_token(user), user=user_service.to_user_public(user))
