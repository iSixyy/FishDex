from pydantic import BaseModel

from app.schemas.user import UserPublic


class RankingEntry(BaseModel):
    position: int
    user: UserPublic


class FriendsRanking(BaseModel):
    entries: list[RankingEntry]
