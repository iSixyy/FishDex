"""Identificación de especies por foto y alta de especies nuevas.

Regla de rareza: la rareza es una propiedad de la ESPECIE, no del usuario.
- Especies del catálogo curado: conservan su rareza de siempre.
- Especie que la IA ve por primera vez: se da de alta en el catálogo común
  con la rareza derivada de lo difícil que es pescarla (`catch_difficulty`),
  y esa rareza queda fijada para todos. La siguiente persona que pesque esa
  especie encontrará la misma ficha y la misma rareza.
"""
import re
import unicodedata
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.game_config import (
    AI_MAX_NEW_SPECIES_PER_USER_PER_DAY,
    AI_MIN_CONFIDENCE_TO_CREATE_SPECIES,
    AI_SPECIES_MAX_RARITY,
    cap_rarity,
    rarity_for_catch_difficulty,
)
from app.models.fish_species import FishSpecies, SpeciesOrigin
from app.services.ai_service import FishIdentification


# "Género especie" (opcionalmente con subespecie). Un nombre que no lo cumpla
# ("Pez", "Fish", "Desconocido") no se da de alta en el catálogo común.
_BINOMIAL = re.compile(r"^[A-Z][a-z]+ [a-z]+(?: [a-z]+)?$")


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


def create_species_from_ai(db: Session, ident: FishIdentification, created_by_id: int | None = None) -> FishSpecies:
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
            # La dificultad la puntúa la IA a partir de una foto cualquiera: se
            # limita la rareza (ver `AI_SPECIES_MAX_RARITY`) para que no se pueda
            # farmear ELO creando especies "míticas".
            rarity=cap_rarity(rarity_for_catch_difficulty(ident.catch_difficulty), AI_SPECIES_MAX_RARITY).value,
            habitat=ident.habitat,
            water_type=ident.water_type,
            region=ident.region,
            catch_difficulty=ident.catch_difficulty,
            origin=SpeciesOrigin.AI,
            created_by_id=created_by_id,
            created_at=datetime.now(timezone.utc),
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


def _species_created_today_by(db: Session, user_id: int) -> int:
    since = datetime.now(timezone.utc) - timedelta(days=1)
    return (
        db.query(FishSpecies)
        .filter(FishSpecies.created_by_id == user_id, FishSpecies.created_at >= since.replace(tzinfo=None))
        .count()
    )


def resolve_identification(
    db: Session, ident: FishIdentification, user_id: int | None = None
) -> tuple[FishSpecies | None, bool]:
    """Devuelve (especie, es_nueva_en_catálogo). La especie es None si no
    existe y no se puede dar de alta: la IA no estaba lo bastante segura, el
    nombre científico no es un binomio válido o el usuario ya ha añadido
    hoy el máximo de especies nuevas al catálogo común."""
    species = find_matching_species(db, ident)
    if species is not None:
        return species, False
    if ident.confidence < AI_MIN_CONFIDENCE_TO_CREATE_SPECIES or not _BINOMIAL.match(ident.scientific_name):
        return None, False
    if user_id is not None and _species_created_today_by(db, user_id) >= AI_MAX_NEW_SPECIES_PER_USER_PER_DAY:
        return None, False
    return create_species_from_ai(db, ident, created_by_id=user_id), True
