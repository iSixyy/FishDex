from sqlalchemy.orm import Session

from app.core.game_config import RARITY_META, Rarity
from app.models.capture import Capture
from app.models.fish_species import FishSpecies
from app.schemas.fish import FishCatalogEntry, FishDexProgress, FishSpeciesDetail, FishSpeciesSummary, RegulationPublic
from app.services.image_service import to_public_url


def get_discovered_species_ids(db: Session, user_id: int) -> set[int]:
    rows = db.query(Capture.fish_species_id).filter(Capture.user_id == user_id).distinct().all()
    return {row[0] for row in rows}


def _latest_thumbnails(db: Session, user_id: int) -> dict[int, str]:
    """Miniatura de la foto más reciente de cada especie capturada: hace de
    "sprite" de la entrada en la FishDex (las especies no traen imagen)."""
    rows = (
        db.query(Capture.fish_species_id, Capture.thumbnail_path)
        .filter(Capture.user_id == user_id, Capture.thumbnail_path.isnot(None))
        .order_by(Capture.captured_at.asc(), Capture.id.asc())
        .all()
    )
    return {species_id: path for species_id, path in rows}  # la última gana


def build_fishdex_progress(db: Session, user_id: int) -> FishDexProgress:
    all_species = db.query(FishSpecies).order_by(FishSpecies.dex_number).all()
    discovered_ids = get_discovered_species_ids(db, user_id)
    thumbnails = _latest_thumbnails(db, user_id)

    summaries = []
    for species in all_species:
        unlocked = species.id in discovered_ids
        meta = RARITY_META[Rarity(species.rarity)]
        summaries.append(
            FishSpeciesSummary(
                id=species.id,
                dex_number=species.dex_number,
                name=species.name if unlocked else None,
                rarity=species.rarity if unlocked else None,
                rarity_label=meta["label"] if unlocked else None,
                rarity_color=meta["color"] if unlocked else None,
                image_url=(to_public_url(thumbnails.get(species.id) or species.image_url) if unlocked else None),
                water_type=species.water_type if unlocked else None,
                unlocked=unlocked,
            )
        )

    return FishDexProgress(discovered=len(discovered_ids), total=len(all_species), species=summaries)


def build_species_catalog(db: Session) -> list[FishCatalogEntry]:
    all_species = db.query(FishSpecies).order_by(FishSpecies.name).all()
    return [
        FishCatalogEntry(
            id=s.id,
            dex_number=s.dex_number,
            name=s.name,
            rarity=s.rarity,
            rarity_label=RARITY_META[Rarity(s.rarity)]["label"],
            rarity_color=RARITY_META[Rarity(s.rarity)]["color"],
            water_type=s.water_type,
            origin=s.origin,
        )
        for s in all_species
    ]


def species_to_detail(species: FishSpecies) -> FishSpeciesDetail:
    meta = RARITY_META[Rarity(species.rarity)]
    return FishSpeciesDetail(
        id=species.id,
        dex_number=species.dex_number,
        name=species.name,
        scientific_name=species.scientific_name,
        description=species.description,
        fun_fact=species.fun_fact,
        min_weight_kg=species.min_weight_kg,
        max_weight_kg=species.max_weight_kg,
        approx_min_length_cm=species.approx_min_length_cm,
        approx_max_length_cm=species.approx_max_length_cm,
        rarity=species.rarity,
        rarity_label=meta["label"],
        rarity_color=meta["color"],
        habitat=species.habitat,
        water_type=species.water_type,
        region=species.region,
        image_url=to_public_url(species.image_url),
        catch_difficulty=species.catch_difficulty,
        origin=species.origin,
        regulations=[RegulationPublic.model_validate(r) for r in species.regulations],
    )
