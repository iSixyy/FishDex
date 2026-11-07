from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.challenge import Challenge
from app.models.user import User
from app.schemas.extra import ChallengeCreate, ChallengeParticipantPublic, ChallengePublic, ChallengeResponse, EventCreate
from app.services import challenge_service
from app.services.user_service import to_user_public

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _to_public(db: Session, challenge: Challenge, viewer: User) -> ChallengePublic:
    ranking = challenge_service.scores(db, challenge)
    positions = {u.id: (i + 1, score) for i, (u, score) in enumerate(ranking)}
    participants = [
        ChallengeParticipantPublic(
            user=to_user_public(p.user),
            status=p.status,
            score=positions.get(p.user_id, (None, 0.0))[1],
            position=positions.get(p.user_id, (None, 0.0))[0],
        )
        for p in challenge.participants
    ]
    participants.sort(key=lambda p: (p.position is None, p.position or 0))
    mine = next((p for p in challenge.participants if p.user_id == viewer.id), None)
    winner = next((p.user for p in challenge.participants if p.user_id == challenge.winner_id), None)
    return ChallengePublic(
        id=challenge.id,
        kind=challenge.kind,
        title=challenge.title,
        criterion=challenge.criterion,
        criterion_label=challenge_service.CRITERION_LABELS[challenge.criterion],
        species_id=challenge.fish_species_id,
        species_name=challenge.species.name if challenge.species else None,
        duration_days=challenge.duration_days,
        status=challenge.status,
        starts_at=challenge.starts_at,
        ends_at=challenge.ends_at,
        creator=to_user_public(challenge.creator),
        winner=to_user_public(winner) if winner else None,
        my_status=mine.status if mine else None,
        participants=participants,
    )


@router.get("", response_model=list[ChallengePublic])
def list_challenges(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ChallengePublic]:
    return [_to_public(db, c, user) for c in challenge_service.list_for_user(db, user)]


@router.post("", response_model=ChallengePublic, status_code=201)
def create_challenge(
    payload: ChallengeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ChallengePublic:
    """Un amigo = reto 1v1; varios = torneo."""
    challenge = challenge_service.create_friend_challenge(
        db, user, friend_ids=payload.friend_ids, title=payload.title, criterion=payload.criterion,
        duration_days=payload.duration_days, species_id=payload.species_id,
    )
    return _to_public(db, challenge, user)


@router.post("/events", response_model=ChallengePublic, status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ChallengePublic:
    event = challenge_service.create_event(
        db, user, title=payload.title, criterion=payload.criterion,
        duration_days=payload.duration_days, species_id=payload.species_id,
    )
    return _to_public(db, event, user)


@router.get("/{challenge_id}", response_model=ChallengePublic)
def get_challenge(challenge_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ChallengePublic:
    return _to_public(db, challenge_service.get_visible_challenge_or_404(db, user, challenge_id), user)


@router.post("/{challenge_id}/respond", response_model=ChallengePublic)
def respond_challenge(
    challenge_id: int, payload: ChallengeResponse, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ChallengePublic:
    return _to_public(db, challenge_service.respond(db, user, challenge_id, payload.accept), user)


@router.post("/{challenge_id}/join", response_model=ChallengePublic)
def join_event(challenge_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ChallengePublic:
    return _to_public(db, challenge_service.join_event(db, user, challenge_id), user)


@router.delete("/{challenge_id}", status_code=204)
def cancel_challenge(challenge_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    challenge_service.cancel(db, user, challenge_id)
