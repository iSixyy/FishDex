"""Temporadas: ranking trimestral que se reinicia cada 3 meses.

El ELO global premia la antigüedad: quien lleva años pescando siempre va por
delante. La temporada solo suma el ELO de las capturas PESCADAS dentro del
trimestre (hora peninsular), así que cada 3 meses todos empiezan de cero.
Al cerrarse (con unos días de margen para las capturas offline) se reparten
insignias: campeón, podio, top 10 y participante.
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.game_config import GAME_TIMEZONE
from app.models.capture import Capture
from app.models.season import SeasonAward, SeasonTier
from app.models.user import User
from app.services import notification_service
from app.services.ranking_service import _grouped_ranking

_TZ = ZoneInfo(GAME_TIMEZONE)
# Margen tras el cierre para que lleguen las capturas pescadas sin conexión.
AWARD_GRACE = timedelta(days=3)
_SEASON_NAMES = {1: "invierno", 2: "primavera", 3: "verano", 4: "otoño"}

TIER_LABELS = {
    SeasonTier.CHAMPION: "Campeón de temporada",
    SeasonTier.PODIUM: "Podio de temporada",
    SeasonTier.TOP10: "Top 10 de temporada",
    SeasonTier.PARTICIPANT: "Participante de temporada",
}
# Qué posiciones recibe cada insignia (para mostrarlo en la app).
REWARDS = [
    (SeasonTier.CHAMPION, "1.º puesto"),
    (SeasonTier.PODIUM, "2.º y 3.º"),
    (SeasonTier.TOP10, "4.º a 10.º"),
    (SeasonTier.PARTICIPANT, "Sumar puntos en la temporada"),
]


@dataclass(frozen=True)
class Season:
    year: int
    quarter: int  # 1..4

    @property
    def key(self) -> str:
        return f"{self.year}-T{self.quarter}"

    @property
    def name(self) -> str:
        return f"Temporada de {_SEASON_NAMES[self.quarter]} {self.year}"

    @property
    def starts_at(self) -> datetime:
        return datetime(self.year, 3 * (self.quarter - 1) + 1, 1, tzinfo=_TZ)

    @property
    def ends_at(self) -> datetime:
        return self.next().starts_at

    def next(self) -> "Season":
        return Season(self.year + (self.quarter == 4), self.quarter % 4 + 1)

    def previous(self) -> "Season":
        return Season(self.year - (self.quarter == 1), (self.quarter - 2) % 4 + 1)

    @classmethod
    def from_key(cls, key: str) -> "Season":
        year, quarter = key.split("-T")
        return cls(int(year), int(quarter))


def season_for(moment: datetime | date | None = None) -> Season:
    if moment is None:
        moment = datetime.now(_TZ)
    if isinstance(moment, datetime):
        moment = (moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)).astimezone(_TZ)
    return Season(moment.year, (moment.month - 1) // 3 + 1)


def _utc_naive(moment: datetime) -> datetime:
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


def _filters(season: Season) -> list:
    return [
        Capture.captured_at >= _utc_naive(season.starts_at),
        Capture.captured_at < _utc_naive(season.ends_at),
        Capture.elo_earned > 0,
    ]


def season_ranking(db: Session, season: Season, me: User, limit: int, offset: int):
    """(entradas, mi entrada) con los puntos de la temporada (suma de ELO)."""
    return _grouped_ranking(db, func.sum(Capture.elo_earned), _filters(season), me, limit, offset)


def _tier_for(position: int) -> str:
    if position == 1:
        return SeasonTier.CHAMPION
    if position <= 3:
        return SeasonTier.PODIUM
    if position <= 10:
        return SeasonTier.TOP10
    return SeasonTier.PARTICIPANT


def award_season(db: Session, season: Season) -> int:
    """Reparte las insignias de una temporada cerrada. Idempotente: si ya se
    repartieron (o otro worker lo está haciendo) no hace nada. Devuelve
    cuántas insignias ha creado."""
    if db.query(SeasonAward.id).filter(SeasonAward.season_key == season.key).first() is not None:
        return 0
    rows = (
        db.query(Capture.user_id, func.sum(Capture.elo_earned).label("points"))
        .filter(*_filters(season))
        .group_by(Capture.user_id)
        .order_by(func.sum(Capture.elo_earned).desc(), Capture.user_id.asc())
        .all()
    )
    awards = [
        SeasonAward(season_key=season.key, user_id=user_id, position=i + 1, points=int(points), tier=_tier_for(i + 1))
        for i, (user_id, points) in enumerate(rows)
    ]
    db.add_all(awards)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return 0
    for award in awards:
        notification_service.notify_users(
            db, [award.user_id], f"{season.name}: ¡cerrada!",
            f"Has quedado {award.position}.º con {award.points} puntos. Insignia: {TIER_LABELS[award.tier]}.",
            {"type": "season_award", "season": season.key},
        )
    return len(awards)


def award_finished_seasons(db: Session, now: datetime | None = None) -> None:
    """Tarea periódica: reparte la temporada anterior pasado el margen."""
    now = now or datetime.now(_TZ)
    previous = season_for(now).previous()
    if now >= previous.ends_at + AWARD_GRACE:
        award_season(db, previous)


def awards_for_user(db: Session, user_id: int) -> list:
    from app.schemas.season import SeasonAwardPublic

    rows = db.query(SeasonAward).filter(SeasonAward.user_id == user_id).order_by(SeasonAward.season_key.desc()).all()
    return [
        SeasonAwardPublic(
            season_key=a.season_key,
            season_name=Season.from_key(a.season_key).name,
            position=a.position,
            points=a.points,
            tier=a.tier,
            tier_label=TIER_LABELS.get(a.tier, a.tier),
        )
        for a in rows
    ]
