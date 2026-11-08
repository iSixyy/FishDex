"""Desbloqueo de logros a partir de métricas del usuario.

`evaluate_achievements` es idempotente: calcula todas las métricas, compara
con los umbrales de `app/core/achievements.py` y desbloquea lo que falte. Se
llama tras cada evento que puede mover una métrica (captura, amistad, spot,
reto ganado...). Los logros nunca se retiran, aunque luego se borre una
captura: lo conseguido, conseguido está.
"""
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.achievements import ACHIEVEMENT_DEFS, ACHIEVEMENTS_BY_CODE, SHOWCASE_SIZE, TIER_ORDER
from app.core.game_config import Rarity
from app.models.achievement import Achievement, UserAchievement
from app.models.capture import Capture
from app.models.challenge import Challenge
from app.models.fish_species import FishSpecies
from app.models.friend import Friend
from app.models.spot import Spot

_RARE_PLUS = [Rarity.RARE.value, Rarity.EPIC.value, Rarity.LEGENDARY.value, Rarity.MYTHIC.value]
_EPIC_PLUS = [Rarity.EPIC.value, Rarity.LEGENDARY.value, Rarity.MYTHIC.value]
_LEGENDARY_PLUS = [Rarity.LEGENDARY.value, Rarity.MYTHIC.value]


def _species_count(db: Session, user_id: int, rarities: list[str] | None = None) -> int:
    query = db.query(Capture.fish_species_id).filter(Capture.user_id == user_id)
    if rarities is not None:
        query = query.join(FishSpecies, FishSpecies.id == Capture.fish_species_id).filter(
            FishSpecies.rarity.in_(rarities)
        )
    return query.distinct().count()


def _compute_metrics(db: Session, user_id: int) -> dict[str, float]:
    captures = db.query(Capture).filter(Capture.user_id == user_id)
    heaviest, longest = (
        db.query(func.max(Capture.weight_kg), func.max(Capture.length_cm)).filter(Capture.user_id == user_id).one()
    )
    return {
        "total_captures": captures.count(),
        "species_discovered": _species_count(db, user_id),
        "rare_plus_species": _species_count(db, user_id, _RARE_PLUS),
        "epic_plus_species": _species_count(db, user_id, _EPIC_PLUS),
        "legendary_plus_species": _species_count(db, user_id, _LEGENDARY_PLUS),
        "heaviest_kg": heaviest or 0,
        "longest_cm": longest or 0,
        "regions": (
            db.query(Capture.autonomous_community)
            .filter(Capture.user_id == user_id, Capture.autonomous_community.isnot(None))
            .distinct()
            .count()
        ),
        "friends": db.query(Friend).filter(Friend.user_id == user_id).count(),
        # La primera captura de cada especie cuenta como "especie nueva", no
        # como récord: solo se cuentan las que batieron una marca previa.
        "personal_records": captures.filter(
            Capture.is_new_species.is_(False),
            or_(Capture.is_personal_record_weight.is_(True), Capture.is_personal_record_length.is_(True)),
        ).count(),
        "captures_with_photo": captures.filter(Capture.image_path.isnot(None)).count(),
        "released_captures": captures.filter(Capture.released.is_(True)).count(),
        "challenges_won": db.query(Challenge).filter(Challenge.winner_id == user_id).count(),
        "spots": db.query(Spot).filter(Spot.user_id == user_id).count(),
    }


def _already_unlocked_codes(db: Session, user_id: int) -> set[str]:
    rows = (
        db.query(Achievement.code)
        .join(UserAchievement, UserAchievement.achievement_id == Achievement.id)
        .filter(UserAchievement.user_id == user_id)
        .all()
    )
    return {row[0] for row in rows}


def _unlock(db: Session, user_id: int, achievement: Achievement) -> bool:
    # "check-then-insert": la comprobación previa no basta si dos eventos del
    # mismo usuario llegan a la vez. Se inserta dentro de un SAVEPOINT para
    # que un choque con la UniqueConstraint solo deshaga este INSERT, no la
    # captura (u otra operación) de la transacción exterior.
    try:
        with db.begin_nested():
            db.add(UserAchievement(user_id=user_id, achievement_id=achievement.id))
    except IntegrityError:
        return False
    return True


def evaluate_achievements(db: Session, user_id: int) -> list[Achievement]:
    """Desbloquea (sin confirmar la transacción) todos los logros cuyo umbral
    ya se cumple. Devuelve los recién desbloqueados, en orden de catálogo."""
    # Las sesiones no hacen autoflush: sin esto, las métricas no verían los
    # cambios pendientes del llamador (ganador de un reto, banderas de récord
    # recién recalculadas...) y no se desbloquearía lo que corresponde.
    db.flush()
    already = _already_unlocked_codes(db, user_id)
    pending = [d for d in ACHIEVEMENT_DEFS if d["code"] not in already]
    if not pending:
        return []
    metrics = _compute_metrics(db, user_id)
    reached = [d["code"] for d in pending if metrics.get(d["metric"], 0) >= d["threshold"]]
    if not reached:
        return []
    by_code = {a.code: a for a in db.query(Achievement).filter(Achievement.code.in_(reached)).all()}
    unlocked: list[Achievement] = []
    for code in reached:
        achievement = by_code.get(code)  # None si el seed aún no se ha actualizado
        if achievement is not None and _unlock(db, user_id, achievement):
            unlocked.append(achievement)
    return unlocked


def list_user_achievements(db: Session, user_id: int) -> list[tuple[Achievement, object | None]]:
    """Todos los logros del catálogo con su fecha de desbloqueo (o None)."""
    unlocked = {
        row.achievement_id: row.unlocked_at
        for row in db.query(UserAchievement).filter(UserAchievement.user_id == user_id).all()
    }
    achievements = db.query(Achievement).order_by(Achievement.sort_order, Achievement.id).all()
    return [(a, unlocked.get(a.id)) for a in achievements]


def showcase(db: Session, user_id: int, featured_codes: str | None) -> list[tuple[Achievement, object]]:
    """Insignias de la vitrina: las elegidas por el usuario (si siguen
    desbloqueadas) o, si no eligió, las de mayor nivel más recientes."""
    unlocked = [(a, at) for a, at in list_user_achievements(db, user_id) if at is not None]
    chosen = [c for c in (featured_codes or "").split(",") if c]
    if chosen:
        by_code = {a.code: (a, at) for a, at in unlocked}
        picked = [by_code[c] for c in chosen if c in by_code]
        if picked:
            return picked[:SHOWCASE_SIZE]
    unlocked.sort(key=lambda item: (TIER_ORDER.get(item[0].tier, 0), str(item[1])), reverse=True)
    return unlocked[:SHOWCASE_SIZE]


def validate_showcase_codes(db: Session, user_id: int, codes: list[str]) -> list[str]:
    """Filtra a códigos existentes y desbloqueados, sin repetidos, máx. 3."""
    unlocked = _already_unlocked_codes(db, user_id)
    result: list[str] = []
    for code in codes:
        if code in ACHIEVEMENTS_BY_CODE and code in unlocked and code not in result:
            result.append(code)
    return result[:SHOWCASE_SIZE]


def to_public(achievement: Achievement, unlocked_at) -> "AchievementPublic":
    from app.schemas.common import AchievementPublic

    return AchievementPublic(
        code=achievement.code,
        name=achievement.name,
        description=achievement.description,
        icon=achievement.icon,
        category=achievement.category,
        tier=achievement.tier,
        unlocked=unlocked_at is not None,
        # Se pasa el datetime tal cual: `UtcDateTime` lo serializa con offset
        # UTC. Con `.isoformat()` salía sin zona (SQLite no la guarda) y el
        # móvil lo interpretaba como hora local.
        unlocked_at=unlocked_at,
    )
