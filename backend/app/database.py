"""Motor SQLAlchemy y utilidades de sesión.

Usa SQLite para el MVP. Al usar SQLAlchemy Core/ORM de forma estándar
(sin sintaxis específica de SQLite en los modelos), migrar a PostgreSQL
en el futuro solo requiere cambiar `DATABASE_URL`.
"""
import logging
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("fishdex.db")

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _) -> None:
    """SQLite no aplica las `ForeignKey` de los modelos por defecto: son solo
    metadatos hasta que se activa este pragma en cada conexión nueva."""
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Crea todas las tablas si no existen. Para el MVP se evita Alembic;
    la estructura de modelos ya está preparada para introducirlo después."""
    from app import models  # noqa: F401 aseguramos que los modelos se registren

    Base.metadata.create_all(bind=engine)
    run_light_migrations()


def run_light_migrations() -> None:
    """Apaño de MVP para añadir columnas nuevas a tablas ya existentes.

    `create_all()` solo crea tablas que no existen: si `captures` ya existe
    en `fishdex.db` (como ocurre en producción, con datos reales) nunca le
    añade columnas nuevas del modelo. Mientras no haya Alembic, se cubre el
    caso mínimo a mano con `ALTER TABLE ... ADD COLUMN` sobre SQLite,
    comprobando antes con `PRAGMA table_info` para que sea idempotente.
    """
    if not settings.database_url.startswith("sqlite"):
        return

    columnas_nuevas = {
        "captures": [
            ("bait_technique", "VARCHAR(120)"),
            ("client_id", "VARCHAR(64)"),
            ("weather_json", "TEXT"),
        ],
        "users": [
            ("featured_badges", "VARCHAR(255)"),
            ("token_version", "INTEGER NOT NULL DEFAULT 0"),
        ],
        "fish_species": [
            ("catch_difficulty", "INTEGER"),
            ("origin", "VARCHAR(10) NOT NULL DEFAULT 'SEED'"),
            ("created_by_id", "INTEGER"),
            ("created_at", "DATETIME"),
        ],
        "achievements": [
            ("category", "VARCHAR(40)"),
            ("tier", "VARCHAR(10)"),
            ("sort_order", "INTEGER NOT NULL DEFAULT 0"),
        ],
        "regulations": [
            ("closed_season_start", "VARCHAR(5)"),
            ("closed_season_end", "VARCHAR(5)"),
        ],
    }
    # `ALTER TABLE` no puede añadir restricciones UNIQUE en SQLite, pero un
    # índice único equivale a ella. Deben coincidir con los `Index` de los modelos.
    indices_nuevos = [
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_capture_client_id ON captures (user_id, client_id)",
    ]
    # Unicidad de usuario/email sin distinguir mayúsculas. Si la base ya tiene
    # duplicados ("Pepe" y "pepe") el índice no puede crearse: se avisa en el
    # log en vez de impedir el arranque, y el registro sigue comprobándolo.
    indices_opcionales = [
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_ci ON users (lower(username))",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_ci ON users (lower(email))",
    ]

    with engine.connect() as conn:
        for tabla, columnas in columnas_nuevas.items():
            existentes = {
                row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({tabla})").fetchall()
            }
            for nombre, tipo_sql in columnas:
                if nombre not in existentes:
                    conn.exec_driver_sql(f"ALTER TABLE {tabla} ADD COLUMN {nombre} {tipo_sql}")
        for sentencia in indices_nuevos:
            conn.exec_driver_sql(sentencia)
        conn.commit()
        for sentencia in indices_opcionales:
            try:
                conn.exec_driver_sql(sentencia)
                conn.commit()
            except (IntegrityError, OperationalError):
                conn.rollback()
                logger.warning(
                    "No se pudo crear un índice único sin mayúsculas (¿usuarios duplicados?): %s", sentencia
                )
