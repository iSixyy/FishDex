from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.capture import Capture
from app.models.user import User
from app.schemas.map import MapCapturePin
from app.services.image_service import to_public_url

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/captures", response_model=list[MapCapturePin])
def get_map_captures(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[MapCapturePin]:
    """Capturas del usuario CON coordenadas exactas: son suyas, así que se
    muestran sin difuminar. Nunca se exponen coordenadas de otros usuarios."""
    captures = (
        db.query(Capture)
        .filter(Capture.user_id == user.id, Capture.latitude.isnot(None), Capture.longitude.isnot(None))
        .order_by(Capture.captured_at.desc())
        .all()
    )
    return [
        MapCapturePin(
            id=c.id,
            fish_species_name=c.species.name,
            rarity=c.species.rarity,
            image_url=to_public_url(c.image_path),
            thumbnail_url=to_public_url(c.thumbnail_path),
            weight_kg=c.weight_kg,
            length_cm=c.length_cm,
            latitude=c.latitude,
            longitude=c.longitude,
            location_name=c.location_name,
            captured_at=c.captured_at,
        )
        for c in captures
    ]
