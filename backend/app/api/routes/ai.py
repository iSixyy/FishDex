from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.game_config import RARITY_META, Rarity
from app.database import get_db
from app.models.fish_species import FishSpecies
from app.models.user import User
from app.schemas.extra import AIIdentifyResponse
from app.schemas.fish import FishCatalogEntry
from app.services.ai_service import ai_service
from app.services.capture_service import read_capture_image
from app.services.species_service import resolve_identification

router = APIRouter(prefix="/ai", tags=["ai"])


def _catalog_entry(species: FishSpecies) -> FishCatalogEntry:
    meta = RARITY_META[Rarity(species.rarity)]
    return FishCatalogEntry(
        id=species.id, dex_number=species.dex_number, name=species.name, rarity=species.rarity,
        rarity_label=meta["label"], rarity_color=meta["color"], water_type=species.water_type,
        origin=species.origin,
    )


def _identify(db: Session, raw: bytes) -> AIIdentifyResponse:
    if not ai_service.is_vision_available():
        return AIIdentifyResponse(
            available=False, identified=False,
            message="La identificación por IA no está disponible ahora mismo. Rellena los datos a mano.",
        )
    ident = ai_service.identify_fish(raw)
    if ident is None:
        return AIIdentifyResponse(
            available=True, identified=False,
            message="No he reconocido ningún pez en la foto. Rellena los datos a mano.",
        )
    species, is_new = resolve_identification(db, ident)
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
async def identify_fish(
    image: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> AIIdentifyResponse:
    """Identifica el pez de la foto y estima peso/longitud. Nunca falla por
    culpa de la IA: si no está disponible, lo dice y el usuario rellena a mano.
    Los valores son solo una SUGERENCIA para autocompletar el formulario."""
    raw = await read_capture_image(image)
    if not raw:
        return AIIdentifyResponse(available=True, identified=False, message="La imagen está vacía.")
    # El modelo de visión puede tardar decenas de segundos: fuera del event loop.
    return await run_in_threadpool(_identify, db, raw)
