from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services import auth_service, user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("3/hour")
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
