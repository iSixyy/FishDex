"""Clasificaciones públicas: global (ELO), por comunidad autónoma (ELO
conseguido con capturas en esa comunidad) y por especie (récord de peso).

Solo exponen usuario, valor y posición: nunca coordenadas ni capturas.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.capture import Capture
from app.models.location import Location
from app.models.user import User


def _page(rows: list[tuple[User, float]], offset: int) -> list[tuple[int, User, float]]:
    return [(offset + i + 1, user, value) for i, (user, value) in enumerate(rows)]


def global_ranking(db: Session, me: User, limit: int, offset: int):
    rows = db.query(User).order_by(User.elo.desc(), User.id.asc()).limit(limit).offset(offset).all()
    my_position = (
        db.query(User).filter((User.elo > me.elo) | ((User.elo == me.elo) & (User.id < me.id))).count() + 1
    )
    return _page([(u, u.elo) for u in rows], offset), (my_position, me, me.elo)


def _grouped_ranking(db: Session, value_column, filters, me: User, limit: int, offset: int):
    subquery = (
        db.query(Capture.user_id.label("user_id"), value_column.label("value"))
        .filter(*filters)
        .group_by(Capture.user_id)
        .subquery()
    )
    rows = (
        db.query(User, subquery.c.value)
        .join(subquery, subquery.c.user_id == User.id)
        .order_by(subquery.c.value.desc(), User.id.asc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    mine = db.query(subquery.c.value).filter(subquery.c.user_id == me.id).scalar()
    my_entry = None
    if mine is not None:
        ahead = (
            db.query(subquery)
            .filter((subquery.c.value > mine) | ((subquery.c.value == mine) & (subquery.c.user_id < me.id)))
            .count()
        )
        my_entry = (ahead + 1, me, mine)
    return _page([(u, v) for u, v in rows], offset), my_entry


def region_ranking(db: Session, community: str, me: User, limit: int, offset: int):
    return _grouped_ranking(
        db, func.sum(Capture.elo_earned), [Capture.autonomous_community == community], me, limit, offset
    )


def species_ranking(db: Session, species_id: int, me: User, limit: int, offset: int):
    return _grouped_ranking(
        db, func.max(Capture.weight_kg), [Capture.fish_species_id == species_id], me, limit, offset
    )


def list_regions(db: Session) -> list[str]:
    rows = db.query(Location.autonomous_community).distinct().order_by(Location.autonomous_community).all()
    return [row[0] for row in rows]
