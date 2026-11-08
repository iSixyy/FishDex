from pydantic import BaseModel


class SeasonAwardPublic(BaseModel):
    season_key: str
    season_name: str
    position: int
    points: int
    tier: str  # CHAMPION | PODIUM | TOP10 | PARTICIPANT
    tier_label: str


class SeasonReward(BaseModel):
    tier: str
    label: str
    positions: str
