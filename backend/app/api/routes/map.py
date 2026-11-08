import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.capture import Capture
from app.models.fish_species import FishSpecies
from app.models.user import User
from app.schemas.map import HeatmapCell, HeatmapResponse, MapCapturePin
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


# Celdas de ~11 km (0,1°). Solo se muestra una celda si en ella han pescado al
# menos `HEATMAP_MIN_ANGLERS` personas distintas: así el mapa enseña ZONAS de
# la comunidad y nunca delata el sitio concreto de una sola persona.
HEATMAP_CELL_DEG = 0.1
HEATMAP_MIN_ANGLERS = 2
HEATMAP_WINDOW = timedelta(days=365)


@router.get("/heatmap", response_model=HeatmapResponse)
def get_heatmap(
    species_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HeatmapResponse:
    """Zonas aproximadas donde la comunidad pesca (una especie o todas) en
    el último año. Sin coordenadas exactas ni autores."""
    species_name = None
    if species_id is not None:
        species = db.query(FishSpecies).filter(FishSpecies.id == species_id).first()
        if species is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Especie no encontrada")
        species_name = species.name
    since = (datetime.now(timezone.utc) - HEATMAP_WINDOW).replace(tzinfo=None)
    query = db.query(Capture.user_id, Capture.latitude, Capture.longitude).filter(
        Capture.latitude.isnot(None), Capture.longitude.isnot(None), Capture.captured_at >= since
    )
    if species_id is not None:
        query = query.filter(Capture.fish_species_id == species_id)

    cells: dict[tuple[int, int], tuple[int, set[int]]] = {}
    for user_id, lat, lon in query:
        key = (math.floor(lat / HEATMAP_CELL_DEG), math.floor(lon / HEATMAP_CELL_DEG))
        count, anglers = cells.get(key, (0, set()))
        anglers.add(user_id)
        cells[key] = (count + 1, anglers)

    visible = [
        HeatmapCell(
            latitude=round((row + 0.5) * HEATMAP_CELL_DEG, 4),
            longitude=round((col + 0.5) * HEATMAP_CELL_DEG, 4),
            captures=count,
            anglers=len(anglers),
        )
        for (row, col), (count, anglers) in cells.items()
        if len(anglers) >= HEATMAP_MIN_ANGLERS
    ]
    visible.sort(key=lambda c: c.captures, reverse=True)
    return HeatmapResponse(
        species_id=species_id,
        species_name=species_name,
        cell_size_deg=HEATMAP_CELL_DEG,
        min_anglers=HEATMAP_MIN_ANGLERS,
        cells=visible,
    )
