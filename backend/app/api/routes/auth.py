from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services import auth_service, user_service

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
