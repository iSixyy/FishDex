from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.database import get_db
from app.models.capture import Capture
from app.models.user import User
from app.schemas.capture import CaptureCreate, CapturePublic, CaptureResult, CaptureUpdate
from app.services.capture_service import (
    capture_to_public,
    create_capture,
    delete_capture,
    read_capture_image,
    update_capture,
)

router = APIRouter(prefix="/captures", tags=["captures"])


@router.post("", response_model=CaptureResult, status_code=201)
async def register_capture(
    fish_species_id: int = Form(...),
    weight_kg: float = Form(...),
    length_cm: float = Form(...),
    captured_at: datetime = Form(...),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    location_name: str | None = Form(default=None),
    bait_technique: str | None = Form(default=None),
    client_id: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CaptureResult:
    try:
        payload = CaptureCreate(
            fish_species_id=fish_species_id,
            weight_kg=weight_kg,
            length_cm=length_cm,
            captured_at=captured_at,
            latitude=latitude,
            longitude=longitude,
            location_name=location_name,
            bait_technique=bait_technique,
            client_id=client_id,
        )
    except ValidationError as exc:
        # `exc.errors()` incluye el ValueError original en `ctx` y el valor de
        # entrada en crudo (p. ej. un datetime). `JSONResponse` usa json.dumps,
        # que no sabe serializar ninguno de los dos y convertiría este 422 en
        # un 500. Se excluye el contexto y se codifica el resto con
        # `jsonable_encoder` para que el cliente reciba siempre un 422 legible.
        raise HTTPException(
            422,
            jsonable_encoder(exc.errors(include_url=False, include_context=False)),
        )

    raw_image = await read_capture_image(image)
    # Todo lo demás es bloqueante (Pillow, SQLAlchemy y la llamada síncrona a
    # Ollama, de hasta varios segundos). Ejecutarlo directamente en esta
    # corrutina congelaría el event loop y con él TODAS las peticiones del
    # servidor mientras dura; en un threadpool solo espera esta petición.
    return await run_in_threadpool(create_capture, db, user, payload, raw_image)


@router.get("", response_model=list[CapturePublic])
def list_captures(
    species_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CapturePublic]:
    # `limit`/`offset` con valores por defecto compatibles con el comportamiento
    # previo (sin paginar) para no romper a la app móvil: como mucho había
    # decenas de capturas por usuario, así que 100 cubre el caso normal.
    query = db.query(Capture).filter(Capture.user_id == user.id)
    if species_id is not None:
        query = query.filter(Capture.fish_species_id == species_id)
    # `id` desempata capturas con el mismo `captured_at`: sin él, el orden de
    # esas filas no está definido y paginar con offset podría repetirlas u
    # omitirlas entre páginas.
    captures = query.order_by(Capture.captured_at.desc(), Capture.id.desc()).limit(limit).offset(offset).all()
    return [capture_to_public(c) for c in captures]


@router.get("/{capture_id}", response_model=CapturePublic)
def get_capture(capture_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> CapturePublic:
    capture = db.query(Capture).filter(Capture.id == capture_id, Capture.user_id == user.id).first()
    if capture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Captura no encontrada")
    return capture_to_public(capture)



@router.patch("/{capture_id}", response_model=CapturePublic)
def edit_capture(
    capture_id: int, payload: CaptureUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> CapturePublic:
    """Corrige una captura propia. El ELO de todo el historial se recalcula
    en el servidor (un cambio puede afectar a récords y especies nuevas)."""
    return update_capture(db, user, capture_id, payload)


@router.delete("/{capture_id}", status_code=204)
def remove_capture(capture_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    delete_capture(db, user, capture_id)
