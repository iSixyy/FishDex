from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # Sin espacios sobrantes: "  " ya no cuenta como nombre válido.
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


from app.schemas.user import UserPublic  # noqa: E402 (evita import circular)

TokenResponse.model_rebuild()
