"""Cálculo de ELO en servidor. El cliente NUNCA envía ni decide el ELO:
todo se recalcula aquí a partir de datos verificables en la base de datos."""
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.game_config import (
    EXCEPTIONAL_SIZE_BONUS_ELO,
    EXCEPTIONAL_SIZE_THRESHOLD_RATIO,
    GAME_TIMEZONE,
    MAX_ELO_REWARDING_CAPTURES_PER_SPECIES_PER_DAY,
    PERSONAL_RECORD_BONUS_ELO,
    RELEASE_BONUS_ELO,
    RARITY_BASE_ELO,
    REPEAT_CAPTURE_ELO_MIN,
    REPEAT_CAPTURE_ELO_RATIO,
    Rarity,
    get_rank_for_elo,
)
from app.models.capture import Capture
from app.models.fish_species import FishSpecies


class EloBreakdown:
    def __init__(self) -> None:
        self.base = 0
        self.record_bonus = 0
        self.size_bonus = 0
        self.release_bonus = 0
        self.capped_by_daily_limit = False

    @property
    def total(self) -> int:
        return self.base + self.record_bonus + self.size_bonus + self.release_bonus


_GAME_TZ = ZoneInfo(GAME_TIMEZONE)


def _as_utc(moment: datetime | None) -> datetime:
    """SQLite devuelve los datetimes sin zona (guardados ya en UTC)."""
    if moment is None:
        return datetime.now(timezone.utc)
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def fishing_day(moment: datetime) -> date:
    """Día de pesca (hora peninsular) al que pertenece un instante."""
    return _as_utc(moment).astimezone(_GAME_TZ).date()


def _fishing_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    """[inicio, fin) de un día de pesca, en UTC y sin zona (como en SQLite)."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=_GAME_TZ)
    end = datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=_GAME_TZ)
    return (
        start.astimezone(timezone.utc).replace(tzinfo=None),
        end.astimezone(timezone.utc).replace(tzinfo=None),
    )


def _daily_rewarding_captures_count(db: Session, user_id: int, species_id: int, captured_at: datetime) -> int:
    """Capturas de esa especie que ya dieron ELO el MISMO día de pesca.

    Se cuenta por `captured_at` (cuándo se pescó), no por `created_at` (cuándo
    llegó al servidor): antes, quien pescaba sin cobertura varios días y
    sincronizaba todo de golpe veía cómo el límite de 3 al día se aplicaba a
    todas sus capturas juntas y perdía el ELO de los demás días. Falsear
    `captured_at` no permite gran cosa: el esquema solo admite fechas pasadas
    de como mucho `MAX_CAPTURED_AT_AGE_DAYS` días y las capturas repetidas
    dan una fracción mínima del ELO base."""
    start, end = _fishing_day_bounds_utc(fishing_day(captured_at))
    return (
        db.query(Capture)
        .filter(
            Capture.user_id == user_id,
            Capture.fish_species_id == species_id,
            Capture.captured_at >= start,
            Capture.captured_at < end,
            Capture.elo_earned > 0,
        )
        .count()
    )


def calculate_capture_elo(
    db: Session,
    *,
    user_id: int,
    species: FishSpecies,
    weight_kg: float,
    length_cm: float,
    is_new_species: bool,
    is_personal_record: bool,
    captured_at: datetime,  # define el día de pesca del límite anti-farmeo
    released: bool = False,
) -> EloBreakdown:
    breakdown = EloBreakdown()
    rarity = Rarity(species.rarity)
    base_elo = RARITY_BASE_ELO[rarity]

    if MAX_ELO_REWARDING_CAPTURES_PER_SPECIES_PER_DAY > 0:
        already_today = _daily_rewarding_captures_count(db, user_id, species.id, captured_at)
        if already_today >= MAX_ELO_REWARDING_CAPTURES_PER_SPECIES_PER_DAY:
            breakdown.capped_by_daily_limit = True
            return breakdown  # 0 ELO: límite diario anti-farmeo alcanzado

    if is_new_species:
        breakdown.base = base_elo
    else:
        breakdown.base = max(REPEAT_CAPTURE_ELO_MIN, round(base_elo * REPEAT_CAPTURE_ELO_RATIO))

    if is_personal_record and not is_new_species:
        breakdown.record_bonus = PERSONAL_RECORD_BONUS_ELO

    size_threshold = species.max_weight_kg * EXCEPTIONAL_SIZE_THRESHOLD_RATIO
    length_threshold = species.approx_max_length_cm * EXCEPTIONAL_SIZE_THRESHOLD_RATIO
    if weight_kg >= size_threshold or length_cm >= length_threshold:
        breakdown.size_bonus = EXCEPTIONAL_SIZE_BONUS_ELO

    if released:
        breakdown.release_bonus = RELEASE_BONUS_ELO

    return breakdown


def rank_name_for_elo(elo: int) -> str:
    return get_rank_for_elo(elo)["name"]


def recalculate_user_elo(db: Session, user_id: int) -> int:
    """Recalcula desde cero el ELO de TODAS las capturas de un usuario,
    repitiendo su historial en el orden en que se registraron.

    Hace falta al editar o borrar una captura: el ELO de cada una depende de
    las anteriores (si fue especie nueva, si batió un récord, el límite
    diario...). Borrar la primera lubina convierte la segunda en "especie
    nueva"; bajar el peso de un récord puede devolverle el récord a otra.
    Con el historial intacto, el resultado es idéntico al cálculo original.

    Actualiza las banderas y `elo_earned` de cada captura y el ELO total del
    usuario, deja constancia de la diferencia en `EloHistory` y devuelve el
    nuevo total. No confirma la transacción.
    """
    from app.models.elo_history import EloHistory
    from app.models.user import User

    captures = (
        db.query(Capture)
        .filter(Capture.user_id == user_id)
        .order_by(Capture.created_at.asc(), Capture.id.asc())
        .all()
    )
    best: dict[int, tuple[float, float]] = {}
    rewarding_per_day: dict[tuple[int, object], int] = {}
    total = 0
    for capture in captures:
        species = capture.species
        previous = best.get(species.id)
        is_new = previous is None
        record_weight = is_new or capture.weight_kg > previous[0]
        record_length = is_new or capture.length_cm > previous[1]
        day_key = (species.id, fishing_day(capture.captured_at))

        breakdown = EloBreakdown()
        if (
            MAX_ELO_REWARDING_CAPTURES_PER_SPECIES_PER_DAY > 0
            and rewarding_per_day.get(day_key, 0) >= MAX_ELO_REWARDING_CAPTURES_PER_SPECIES_PER_DAY
        ):
            breakdown.capped_by_daily_limit = True
        else:
            base_elo = RARITY_BASE_ELO[Rarity(species.rarity)]
            breakdown.base = base_elo if is_new else max(
                REPEAT_CAPTURE_ELO_MIN, round(base_elo * REPEAT_CAPTURE_ELO_RATIO)
            )
            if (record_weight or record_length) and not is_new:
                breakdown.record_bonus = PERSONAL_RECORD_BONUS_ELO
            if (
                capture.weight_kg >= species.max_weight_kg * EXCEPTIONAL_SIZE_THRESHOLD_RATIO
                or capture.length_cm >= species.approx_max_length_cm * EXCEPTIONAL_SIZE_THRESHOLD_RATIO
            ):
                breakdown.size_bonus = EXCEPTIONAL_SIZE_BONUS_ELO
            if capture.released:
                breakdown.release_bonus = RELEASE_BONUS_ELO

        capture.is_new_species = is_new
        capture.is_personal_record_weight = record_weight
        capture.is_personal_record_length = record_length
        capture.elo_earned = breakdown.total
        if breakdown.total > 0:
            rewarding_per_day[day_key] = rewarding_per_day.get(day_key, 0) + 1
        total += breakdown.total
        best[species.id] = (
            max(capture.weight_kg, previous[0]) if previous else capture.weight_kg,
            max(capture.length_cm, previous[1]) if previous else capture.length_cm,
        )

    user = db.query(User).filter(User.id == user_id).one()
    delta = total - user.elo
    if delta != 0:
        db.add(EloHistory(user_id=user_id, capture_id=None, amount=delta, reason="recalculation"))
    user.elo = total
    return total
