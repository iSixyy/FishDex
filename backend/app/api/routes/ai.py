import threading

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.game_config import RARITY_META, Rarity
from app.core.rate_limit import limiter, user_or_ip
from app.database import get_db
from app.models.fish_species import FishSpecies
from app.models.user import User
from app.schemas.extra import AIIdentifyResponse
from app.schemas.fish import FishCatalogEntry
from app.services.ai_service import ai_service
from app.services.capture_service import read_capture_image
from app.services.species_service import resolve_identification

router = APIRouter(prefix="/ai", tags=["ai"])

# Llamadas simultáneas al modelo de visión. Cada una puede tardar hasta
# `ollama_vision_timeout_seconds` (90 s) ocupando un hilo del threadpool que
# comparten TODAS las rutas síncronas de la API: sin tope, unas pocas fotos a
# la vez bastaban para dejar el servidor entero sin hilos libres.
MAX_CONCURRENT_IDENTIFICATIONS = 2
_identify_slots = threading.BoundedSemaphore(MAX_CONCURRENT_IDENTIFICATIONS)


def _catalog_entry(species: FishSpecies) -> FishCatalogEntry:
    meta = RARITY_META[Rarity(species.rarity)]
    return FishCatalogEntry(
        id=species.id, dex_number=species.dex_number, name=species.name, rarity=species.rarity,
        rarity_label=meta["label"], rarity_color=meta["color"], water_type=species.water_type,
        origin=species.origin,
    )


def _identify(db: Session, raw: bytes, user_id: int) -> AIIdentifyResponse:
    if not ai_service.is_vision_available():
        return AIIdentifyResponse(
            available=False, identified=False,
            message="La identificación por IA no está disponible ahora mismo. Rellena los datos a mano.",
        )
    if not _identify_slots.acquire(blocking=False):
        return AIIdentifyResponse(
            available=False, identified=False,
            message="La IA está ocupada con otras fotos. Rellena los datos a mano o inténtalo en un momento.",
        )
    try:
        ident = ai_service.identify_fish(raw)
    finally:
        _identify_slots.release()
    if ident is None:
        return AIIdentifyResponse(
            available=True, identified=False,
            message="No he reconocido ningún pez en la foto. Rellena los datos a mano.",
        )
    species, is_new = resolve_identification(db, ident, user_id=user_id)
    if species is None:
        message = f"Parece un/a {ident.common_name}, pero no estoy seguro. Elige la especie a mano."
    elif is_new:
        message = f"¡{species.name} es nueva en la FishDex! La has añadido tú."
    else:
        message = f"Parece un/a {species.name}. Revisa los datos antes de guardar."
    return AIIdentifyResponse(
        available=True,
        identified=True,
        message=message,
        species=_catalog_entry(species) if species else None,
        species_is_new_in_catalog=is_new,
        suggested_name=ident.common_name,
        scientific_name=ident.scientific_name,
        confidence=ident.confidence,
        estimated_weight_kg=ident.estimated_weight_kg,
        estimated_length_cm=ident.estimated_length_cm,
        catch_difficulty=ident.catch_difficulty,
    )


@router.post("/identify", response_model=AIIdentifyResponse)
@limiter.limit("10/minute;100/day", key_func=user_or_ip)
async def identify_fish(
    request: Request,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AIIdentifyResponse:
    """Identifica el pez de la foto y estima peso/longitud. Nunca falla por
    culpa de la IA: si no está disponible, lo dice y el usuario rellena a mano.
    Los valores son solo una SUGERENCIA para autocompletar el formulario."""
    raw = await read_capture_image(image)
    if not raw:
        return AIIdentifyResponse(available=True, identified=False, message="La imagen está vacía.")
    # El modelo de visión puede tardar decenas de segundos: fuera del event loop.
    return await run_in_threadpool(_identify, db, raw, user.id)
