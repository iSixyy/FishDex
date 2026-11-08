"""Registro central de modelos para que Base.metadata los conozca todos."""
from app.models.achievement import Achievement, UserAchievement
from app.models.capture import Capture
from app.models.challenge import Challenge, ChallengeParticipant
from app.models.device import DeviceToken
from app.models.elo_history import EloHistory
from app.models.fish_species import FishSpecies
from app.models.friend import Friend, FriendRequest
from app.models.location import Location
from app.models.moderation import Report, UserBlock
from app.models.quote import Quote
from app.models.regulation import Regulation
from app.models.season import SeasonAward
from app.models.social import CaptureComment, CaptureLike
from app.models.spot import Spot, SpotPhoto, SpotShare
from app.models.user import User

__all__ = [
    "Achievement",
    "UserAchievement",
    "Capture",
    "CaptureComment",
    "CaptureLike",
    "Challenge",
    "ChallengeParticipant",
    "DeviceToken",
    "EloHistory",
    "FishSpecies",
    "Friend",
    "FriendRequest",
    "Location",
    "Quote",
    "Regulation",
    "Report",
    "SeasonAward",
    "Spot",
    "SpotPhoto",
    "SpotShare",
    "User",
    "UserBlock",
]
