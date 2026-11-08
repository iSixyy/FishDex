"""Construye el feed de comunidad: capturas propias + de amigos, con dos
posibles vistas (`friends`: más recientes; `highlights`: destacadas)."""
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, contains_eager, joinedload

from app.core.game_config import Rarity
from app.models.capture import Capture
from app.models.fish_species import FishSpecies
from app.models.friend import Friend
from app.models.social import CaptureComment, CaptureLike
from app.models.user import User
from app.schemas.feed import FeedEntry
from app.services.image_service import to_public_url
from app.services.user_service import to_user_public

# Orden de prioridad por rareza para `scope=highlights`. Se compara con
# tuplas explícitas (no un dict) porque `case()` en SQLAlchemy 2.0 ya no
# admite mapeos por posición, solo listas de pares (condición, resultado).
_RARITY_RANK = case(
    (FishSpecies.rarity == Rarity.MYTHIC.value, 5),
    (FishSpecies.rarity == Rarity.LEGENDARY.value, 4),
    (FishSpecies.rarity == Rarity.EPIC.value, 3),
    (FishSpecies.rarity == Rarity.RARE.value, 2),
    (FishSpecies.rarity == Rarity.UNCOMMON.value, 1),
    else_=0,
)

# Especie nueva o récord personal (de peso o de longitud): lo que hace que
# una captura sea "destacable" independientemente de la rareza de la especie.
_IS_HIGHLIGHT = case(
    (or_(Capture.is_new_species, Capture.is_personal_record_weight, Capture.is_personal_record_length), 1),
    else_=0,
)


def _visible_user_ids(db: Session, user_id: int) -> list[int]:
    """Amigos del usuario + el propio usuario: el universo de autores cuyas
    capturas pueden aparecer en su feed. Incluir siempre el propio id evita
    que el feed quede vacío cuando el usuario aún no tiene amigos."""
    friend_ids = [row[0] for row in db.query(Friend.friend_id).filter(Friend.user_id == user_id).all()]
    return list({*friend_ids, user_id})


def get_feed(db: Session, user: User, scope: str, limit: int, offset: int) -> list[FeedEntry]:
    visible_ids = _visible_user_ids(db, user.id)

    # Autor y especie se cargan en la misma consulta: antes cada entrada de la
    # página disparaba 2 consultas más (N+1) al leer `c.user` y `c.species`.
    query = (
        db.query(Capture)
        .join(FishSpecies, FishSpecies.id == Capture.fish_species_id)
        .options(contains_eager(Capture.species), joinedload(Capture.user))
        .filter(Capture.user_id.in_(visible_ids))
    )

    # `Capture.id` desempata capturas con el mismo `captured_at`: sin él el
    # orden no está definido y la paginación por offset repetía u omitía
    # entradas entre páginas.
    if scope == "highlights":
        query = query.order_by(
            _IS_HIGHLIGHT.desc(), _RARITY_RANK.desc(), Capture.captured_at.desc(), Capture.id.desc()
        )
    else:
        query = query.order_by(Capture.captured_at.desc(), Capture.id.desc())

    captures = query.limit(limit).offset(offset).all()
    return _to_feed_entries(db, user, captures)


def _to_feed_entries(db: Session, user: User, captures: list[Capture]) -> list[FeedEntry]:
    # Evita el N+1: una consulta agregada (GROUP BY) por métrica sobre todos
    # los ids de la página, en vez de una consulta de likes/comentarios por
    # cada captura (mismo patrón que `friend_service.species_discovered_counts`).
    capture_ids = [c.id for c in captures]
    like_counts = _like_counts(db, capture_ids)
    comment_counts = _comment_counts(db, capture_ids)
    liked_ids = _liked_by_user(db, capture_ids, user.id)

    return [
        FeedEntry(
            id=c.id,
            user=to_user_public(c.user),
            fish_species_name=c.species.name,
            rarity=c.species.rarity,
            image_url=to_public_url(c.image_path),
            thumbnail_url=to_public_url(c.thumbnail_path),
            weight_kg=c.weight_kg,
            length_cm=c.length_cm,
            location_name=c.location_name,
            captured_at=c.captured_at,
            like_count=like_counts.get(c.id, 0),
            comment_count=comment_counts.get(c.id, 0),
            liked_by_me=c.id in liked_ids,
        )
        for c in captures
    ]


def _like_counts(db: Session, capture_ids: list[int]) -> dict[int, int]:
    if not capture_ids:
        return {}
    rows = (
        db.query(CaptureLike.capture_id, func.count(CaptureLike.id))
        .filter(CaptureLike.capture_id.in_(capture_ids))
        .group_by(CaptureLike.capture_id)
        .all()
    )
    return dict(rows)


def _comment_counts(db: Session, capture_ids: list[int]) -> dict[int, int]:
    if not capture_ids:
        return {}
    rows = (
        db.query(CaptureComment.capture_id, func.count(CaptureComment.id))
        .filter(CaptureComment.capture_id.in_(capture_ids))
        .group_by(CaptureComment.capture_id)
        .all()
    )
    return dict(rows)


def _liked_by_user(db: Session, capture_ids: list[int], user_id: int) -> set[int]:
    if not capture_ids:
        return set()
    rows = (
        db.query(CaptureLike.capture_id)
        .filter(CaptureLike.capture_id.in_(capture_ids), CaptureLike.user_id == user_id)
        .all()
    )
    return {row[0] for row in rows}
