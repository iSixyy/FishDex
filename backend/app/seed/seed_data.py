"""Puebla la base de datos con los datos iniciales de España.
Idempotente: se puede ejecutar varias veces sin duplicar filas.

Uso:
    python -m app.seed.seed_data
"""
import logging
import sys

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models.achievement import Achievement
from app.models.fish_species import FishSpecies
from app.models.location import Location
from app.models.quote import Quote
from app.models.regulation import Regulation
from app.seed.achievements_seed import ACHIEVEMENTS_SEED
from app.seed.locations_seed import LOCATIONS_SEED
from app.seed.quotes_seed import QUOTES_SEED
from app.seed.regulations_seed import REGULATIONS_SEED
from app.seed.species_seed import SPECIES_SEED

logger = logging.getLogger("fishdex.seed")


def seed_species(db: Session) -> dict[int, FishSpecies]:
    by_dex: dict[int, FishSpecies] = {}
    for data in SPECIES_SEED:
        species = db.query(FishSpecies).filter(FishSpecies.dex_number == data["dex_number"]).first()
        if species is None:
            species = FishSpecies(**{**data, "rarity": data["rarity"].value})
            db.add(species)
            db.flush()
        by_dex[data["dex_number"]] = species
    return by_dex


def seed_regulations(db: Session, species_by_dex: dict[int, FishSpecies]) -> None:
    for data in REGULATIONS_SEED:
        species = species_by_dex.get(data["species_dex_number"])
        if species is None:
            continue
        exists = (
            db.query(Regulation)
            .filter(
                Regulation.fish_species_id == species.id,
                Regulation.scope == data["scope"],
                # Sin esto, la segunda regulación autonómica de una especie
                # (otra comunidad) se saltaba creyendo que ya existía.
                Regulation.autonomous_community.is_(data["autonomous_community"])
                if data["autonomous_community"] is None
                else Regulation.autonomous_community == data["autonomous_community"],
            )
            .first()
        )
        if exists:
            continue
        db.add(
            Regulation(
                fish_species_id=species.id,
                scope=data["scope"],
                autonomous_community=data["autonomous_community"],
                legal_min_length_cm=data["legal_min_length_cm"],
                closed_season=data["closed_season"],
                daily_catch_limit=data["daily_catch_limit"],
                notes=data["notes"],
                source=data["source"],
            )
        )


def seed_achievements(db: Session) -> None:
    """Upsert por `code`: añade los logros nuevos y actualiza nombre, nivel y
    orden de los existentes sin tocar su id (los desbloqueos se conservan)."""
    existing = {a.code: a for a in db.query(Achievement).all()}
    for data in ACHIEVEMENTS_SEED:
        achievement = existing.get(data["code"])
        if achievement is None:
            db.add(Achievement(**data))
        else:
            for field, value in data.items():
                setattr(achievement, field, value)


def seed_locations(db: Session) -> None:
    if db.query(Location).count() > 0:
        return
    for data in LOCATIONS_SEED:
        db.add(Location(**data))


def seed_quotes(db: Session) -> None:
    if db.query(Quote).count() > 0:
        return
    for data in QUOTES_SEED:
        db.add(Quote(**data))


def run_seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        species_by_dex = seed_species(db)
        seed_regulations(db, species_by_dex)
        seed_achievements(db)
        seed_locations(db)
        seed_quotes(db)
        db.commit()
        logger.info("Seed completado: %d especies, %d frases", len(species_by_dex), len(QUOTES_SEED))
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_seed()
    # La consola de Windows usa cp1252 por defecto y no puede codificar emojis:
    # se escribe en UTF-8 con reconfigure() y se cae a texto plano si no es posible,
    # para que el seed nunca termine con un traceback tras haber funcionado bien.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        print("✅ Base de datos inicial de FishDex poblada correctamente.")
    except (AttributeError, OSError, UnicodeEncodeError):
        print("Base de datos inicial de FishDex poblada correctamente.")
