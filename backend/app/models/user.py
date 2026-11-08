from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.achievement import UserAchievement
    from app.models.capture import Capture
    from app.models.elo_history import EloHistory


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(60), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    elo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Hasta 3 códigos de logro elegidos para la vitrina del perfil, separados
    # por coma. Vacío = se muestran los de mayor nivel automáticamente.
    featured_badges: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Versión de sesión: va en cada JWT y se incrementa al cerrar sesión, lo
    # que invalida todos los tokens emitidos antes.
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Recuperación de contraseña: hash del código de 6 cifras enviado por
    # correo, su caducidad y los intentos fallidos (máx. 5).
    password_reset_code_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_reset_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Licencia de pesca: caducidad, comunidad que la expide y último aviso
    # enviado (0 = ninguno, 1 = a 30 días, 2 = a 7 días, 3 = caducada).
    license_expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    license_region: Mapped[str | None] = mapped_column(String(80), nullable=True)
    license_reminder_stage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    captures: Mapped[list["Capture"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    elo_history: Mapped[list["EloHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    achievements: Mapped[list["UserAchievement"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    @property
    def is_admin(self) -> bool:
        # Import diferido: evita el ciclo config -> models al importar.
        from app.config import get_settings

        return self.username.lower() in get_settings().admin_username_set


# Unicidad SIN distinguir mayúsculas: con la restricción normal "Samuel" y
# "samuel" eran usuarios distintos, y como `is_admin` compara en minúsculas
# cualquiera podía registrar una variante del nombre de un administrador y
# heredar sus permisos. Los nombres deben coincidir con `run_light_migrations`.
Index("uq_users_username_ci", func.lower(User.username), unique=True)
Index("uq_users_email_ci", func.lower(User.email), unique=True)
