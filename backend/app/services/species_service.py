"""Identificación de especies por foto y alta de especies nuevas.

Regla de rareza: la rareza es una propiedad de la ESPECIE, no del usuario.
- Especies del catálogo curado: conservan su rareza de siempre.
- Especie que la IA ve por primera vez: se da de alta en el catálogo común
  con la rareza derivada de lo difícil que es pescarla (`catch_difficulty`),
  y esa rareza queda fijada para todos. La siguiente persona que pesque esa
  especie encontrará la misma ficha y la misma rareza.
"""
import unicodedata

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.game_config import AI_MIN_CONFIDENCE_TO_CREATE_SPECIES, rarity_for_catch_difficulty
from app.models.fish_species import FishSpecies, SpeciesOrigin
from app.services.ai_service import FishIdentification


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower().strip()


def find_matching_species(db: Session, ident: FishIdentification) -> FishSpecies | None:
    """Busca la especie por nombre científico y, si no, por nombre común
    (sin tildes ni mayúsculas)."""
    by_scientific = (
        db.query(FishSpecies)
        .filter(func.lower(FishSpecies.scientific_name) == ident.scientific_name.lower())
        .first()
    )
    if by_scientific is not None:
        return by_scientific
    wanted = _normalize(ident.common_name)
    for species in db.query(FishSpecies).all():
        if _normalize(species.name) == wanted:
            return species
    return None


def create_species_from_ai(db: Session, ident: FishIdentification) -> FishSpecies:
    typical_max_weight = ident.typical_max_weight_kg or max((ident.estimated_weight_kg or 1) * 2, 0.5)
    typical_max_length = ident.typical_max_length_cm or max((ident.estimated_length_cm or 30) * 1.5, 10)
    for _attempt in range(3):
        next_dex = (db.query(func.max(FishSpecies.dex_number)).scalar() or 0) + 1
        species = FishSpecies(
            dex_number=next_dex,
            name=ident.common_name,
            scientific_name=ident.scientific_name,
            description=ident.description,
            fun_fact=ident.fun_fact,
            min_weight_kg=round(typical_max_weight * 0.1, 2),
            max_weight_kg=round(typical_max_weight, 2),
            approx_min_length_cm=round(typical_max_length * 0.3, 1),
            approx_max_length_cm=round(typical_max_length, 1),
            rarity=rarity_for_catch_difficulty(ident.catch_difficulty).value,
            habitat=ident.habitat,
            water_type=ident.water_type,
            region=ident.region,
            catch_difficulty=ident.catch_difficulty,
            origin=SpeciesOrigin.AI,
        )
        db.add(species)
        try:
            db.commit()
        except IntegrityError:
            # Otro usuario ha dado de alta una especie a la vez y se ha llevado
            # el mismo número de Dex: se reintenta, o se reutiliza si era la misma.
            db.rollback()
            existing = find_matching_species(db, ident)
            if existing is not None:
                return existing
            continue
        db.refresh(species)
        return species
    raise RuntimeError("No se pudo asignar un número de FishDex a la especie nueva")


def resolve_identification(db: Session, ident: FishIdentification) -> tuple[FishSpecies | None, bool]:
    """Devuelve (especie, es_nueva_en_catálogo). La especie es None si no
    existe y la IA no estaba lo bastante segura como para darla de alta."""
    species = find_matching_species(db, ident)
    if species is not None:
        return species, False
    if ident.confidence < AI_MIN_CONFIDENCE_TO_CREATE_SPECIES:
        return None, False
    return create_species_from_ai(db, ident), True
