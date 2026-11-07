from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.fish_species import FishSpecies
from app.models.user import User
from app.schemas.fish import FishCatalogEntry, FishDexProgress, FishSpeciesDetail
from app.services.fishdex_service import build_fishdex_progress, build_species_catalog, species_to_detail

router = APIRouter(prefix="/fish", tags=["fish"])


@router.get("", response_model=FishDexProgress)
def list_species(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> FishDexProgress:
    return build_fishdex_progress(db, user.id)


@router.get("/catalog", response_model=list[FishCatalogEntry])
def get_species_catalog(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[FishCatalogEntry]:
    """Catálogo completo de especies (para el selector al registrar una
    captura). Debe declararse antes de `/fish/{species_id}` en el router."""
    return build_species_catalog(db)


@router.get("/{species_id}", response_model=FishSpeciesDetail)
def get_species(
    species_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> FishSpeciesDetail:
    species = db.query(FishSpecies).filter(FishSpecies.id == species_id).first()
    if species is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Especie no encontrada")
    return species_to_detail(species)
