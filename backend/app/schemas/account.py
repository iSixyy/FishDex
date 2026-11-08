from datetime import date
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator

from app.models.moderation import ReportReason, ReportTarget
from app.schemas.types import UtcDateTime

_DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
_Password = Annotated[str, Field(min_length=8, max_length=128)]


class ProfileUpdate(BaseModel):
    display_name: _DisplayName | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: _Password


class PasswordForgot(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\s*\d{6}\s*$")
    new_password: _Password


class AccountDelete(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class LicenseUpdate(BaseModel):
    expires_on: date | None = None
    region: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None

    @field_validator("region")
    @classmethod
    def blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class LicensePublic(BaseModel):
    expires_on: date | None
    region: str | None
    days_left: int | None  # negativo si ya ha caducado


class ReportCreate(BaseModel):
    target_type: str
    target_id: int
    reason: str
    details: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None

    @field_validator("target_type")
    @classmethod
    def valid_target(cls, value: str) -> str:
        if value not in ReportTarget.ALL:
            raise ValueError(f"Tipo no válido. Opciones: {', '.join(ReportTarget.ALL)}")
        return value

    @field_validator("reason")
    @classmethod
    def valid_reason(cls, value: str) -> str:
        if value not in ReportReason.ALL:
            raise ValueError(f"Motivo no válido. Opciones: {', '.join(ReportReason.ALL)}")
        return value


class ReportPublic(BaseModel):
    id: int
    target_type: str
    target_id: int
    reason: str
    details: str | None
    status: str
    created_at: UtcDateTime

    model_config = {"from_attributes": True}
