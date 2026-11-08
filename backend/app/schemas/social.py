from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.schemas.types import UtcDateTime
from app.schemas.user import UserPublic


class CommentCreate(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class CommentPublic(BaseModel):
    id: int
    user: UserPublic
    text: str
    created_at: UtcDateTime
