from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.database import get_db
from app.models.spot import Spot
from app.models.user import User
from app.schemas.extra import SpotCreate, SpotPhotoPublic, SpotPublic, SpotShareUpdate, SpotUpdate
from app.services import spot_service, weather_service
from app.services.capture_service import read_capture_image
from app.services.image_service import to_public_url
from app.services.user_service import to_user_public

router = APIRouter(prefix="/spots", tags=["spots"])


def _to_public(spot: Spot, viewer: User) -> SpotPublic:
    is_mine = spot.user_id == viewer.id
    return SpotPublic(
        id=spot.id,
        owner=to_user_public(spot.owner),
        is_mine=is_mine,
        name=spot.name,
        notes=spot.notes,
        latitude=spot.latitude,
        longitude=spot.longitude,
        photos=[
            SpotPhotoPublic(id=p.id, image_url=to_public_url(p.image_path), thumbnail_url=to_public_url(p.thumbnail_path))
            for p in spot.photos
        ],
        # Con quién está compartido solo le interesa (y solo lo ve) el dueño.
        shared_with=[s.user_id for s in spot.shares] if is_mine else [],
        created_at=spot.created_at,
    )


@router.get("", response_model=list[SpotPublic])
def list_spots(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[SpotPublic]:
    return [_to_public(s, user) for s in spot_service.list_visible_spots(db, user)]


@router.post("", response_model=SpotPublic, status_code=201)
def create_spot(payload: SpotCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SpotPublic:
    spot = spot_service.create_spot(
        db, user, name=payload.name, notes=payload.notes, latitude=payload.latitude, longitude=payload.longitude
    )
    return _to_public(spot, user)


@router.get("/{spot_id}", response_model=SpotPublic)
def get_spot(spot_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SpotPublic:
    return _to_public(spot_service.get_visible_spot_or_404(db, user, spot_id), user)


@router.get("/{spot_id}/weather")
async def get_spot_weather(spot_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    spot = spot_service.get_visible_spot_or_404(db, user, spot_id)
    conditions = await run_in_threadpool(weather_service.get_conditions, spot.latitude, spot.longitude)
    return conditions or {}


@router.patch("/{spot_id}", response_model=SpotPublic)
def update_spot(
    spot_id: int, payload: SpotUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> SpotPublic:
    spot = spot_service.update_spot(db, user, spot_id, payload.model_dump(exclude_unset=True))
    return _to_public(spot, user)


@router.delete("/{spot_id}", status_code=204)
def delete_spot(spot_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    spot_service.delete_spot(db, user, spot_id)


@router.put("/{spot_id}/shares", response_model=SpotPublic)
def share_spot(
    spot_id: int, payload: SpotShareUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> SpotPublic:
    """Sustituye la lista de amigos con los que se comparte (vacía = privado)."""
    return _to_public(spot_service.set_shares(db, user, spot_id, payload.friend_ids), user)


@router.post("/{spot_id}/photos", response_model=SpotPublic, status_code=201)
async def add_spot_photo(
    spot_id: int, image: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> SpotPublic:
    raw = await read_capture_image(image)
    spot = await run_in_threadpool(spot_service.add_photo, db, user, spot_id, raw or b"")
    return _to_public(spot, user)


@router.delete("/{spot_id}/photos/{photo_id}", response_model=SpotPublic)
def delete_spot_photo(
    spot_id: int, photo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> SpotPublic:
    return _to_public(spot_service.delete_photo(db, user, spot_id, photo_id), user)
