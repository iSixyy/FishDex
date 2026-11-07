from pydantic import BaseModel, Field

from app.schemas.types import UtcDateTime
from app.schemas.user import UserPublic


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class CommentPublic(BaseModel):
    id: int
    user: UserPublic
    text: str
    created_at: UtcDateTime
