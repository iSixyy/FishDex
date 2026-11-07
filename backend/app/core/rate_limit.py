"""Limiter de slowapi en módulo propio para evitar imports circulares entre
`app.main` (que registra el exception handler) y las rutas (que aplican
`@limiter.limit(...)`)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings


class _ConfigAwareLimiter(Limiter):
    """`Limiter.enabled` es un atributo normal que slowapi solo lee en cada
    petición (`if self.enabled: ...`), pero antes se fijaba UNA VEZ al
    construir el objeto con `enabled=get_settings().rate_limit_enabled`. Eso
    funciona hoy solo porque `tests/conftest.py` fija `RATE_LIMIT_ENABLED` en
    `os.environ` antes de que nada importe `app` (y por tanto antes de que
    `get_settings()` cachee el `Settings()` con `lru_cache`); si algún import
    se colara antes, la config quedaría cacheada con el valor por defecto para
    siempre. Convertir `enabled` en una property que relee `get_settings()`
    en cada acceso elimina esa fragilidad: ya no depende de "en qué momento
    exacto" se construyó el Limiter, solo de que la config esté bien fijada
    quien sea que llame a `get_settings()` la primera vez.
    """

    @property
    def enabled(self) -> bool:
        return get_settings().rate_limit_enabled

    @enabled.setter
    def enabled(self, _value: bool) -> None:
        # `Limiter.__init__` hace `self.enabled = enabled`; se ignora porque
        # el valor siempre se relee de la configuración (ver el getter).
        pass


limiter = _ConfigAwareLimiter(key_func=get_remote_address, enabled=get_settings().rate_limit_enabled)
