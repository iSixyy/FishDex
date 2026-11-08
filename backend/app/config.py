"""Configuración centralizada de la aplicación, cargada desde variables de entorno."""
import warnings
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

# Valor de fábrica: solo válido en desarrollo/tests. En producción el arranque
# falla si no se sustituye por una clave real (ver `_check_jwt_secret_key`).
_DEFAULT_JWT_SECRET_KEY = "change-this-secret-key-in-production"
_MIN_JWT_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    api_host: str = "localhost"
    api_port: int = 8000
    cors_origins: str = "*"

    environment: str = "development"

    database_url: str = f"sqlite:///{BASE_DIR / 'fishdex.db'}"

    jwt_secret_key: str = _DEFAULT_JWT_SECRET_KEY
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 días

    storage_dir: str = str(BASE_DIR / "storage")

    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    ollama_enabled: bool = True
    ollama_timeout_seconds: int = 5
    # Modelo de VISIÓN para identificar peces por foto (llava, llama3.2-vision,
    # moondream...). Tiene que estar descargado: `ollama pull llava`.
    ollama_vision_model: str = "llava"
    ollama_vision_timeout_seconds: int = 90

    # Clima, mareas y fase lunar (Open-Meteo, gratis y sin clave).
    weather_enabled: bool = True
    weather_timeout_seconds: int = 4

    # Notificaciones push vía el servicio de Expo (sin clave para el MVP).
    push_enabled: bool = True

    # Usuarios con permisos de administración (crear eventos oficiales),
    # separados por coma. Ej: ADMIN_USERNAMES=admin,samuel
    admin_usernames: str = ""

    rate_limit_enabled: bool = True
    # Detrás de un proxy inverso (nginx, Caddy, un balanceador...) todas las
    # peticiones llegan con la IP del proxy y el rate limit por IP se vuelve
    # global. Con esto a `true` se usa la primera IP de `X-Forwarded-For`.
    # Actívalo SOLO si el proxy sobrescribe esa cabecera (si no, se falsea).
    trust_proxy_headers: bool = False
    # Tarea periódica que cierra retos vencidos y envía avisos.
    scheduler_enabled: bool = True

    @property
    def admin_username_set(self) -> set[str]:
        return {name.strip().lower() for name in self.admin_usernames.split(",") if name.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _check_jwt_secret_key(self) -> "Settings":
        """El secreto de fábrica (o uno demasiado corto) solo se tolera fuera
        de producción: en producción el arranque debe fallar en vez de servir
        tokens firmados con una clave adivinable."""
        is_weak = self.jwt_secret_key == _DEFAULT_JWT_SECRET_KEY or len(self.jwt_secret_key) < _MIN_JWT_SECRET_KEY_LENGTH
        if not is_weak:
            return self
        # Se normaliza para que "Production", "PROD", " production " (o su
        # variante corta "prod") también activen la comprobación: comparar
        # de forma sensible a mayúsculas dejaba pasar despistes de config.
        normalized_environment = self.environment.strip().lower()
        if normalized_environment in ("production", "prod"):
            raise RuntimeError(
                "jwt_secret_key inválida: define una clave real de al menos "
                f"{_MIN_JWT_SECRET_KEY_LENGTH} caracteres en ENVIRONMENT=production"
            )
        warnings.warn(
            "jwt_secret_key es el valor por defecto o demasiado corta; "
            "esto solo es aceptable en desarrollo/tests.",
            stacklevel=2,
        )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
