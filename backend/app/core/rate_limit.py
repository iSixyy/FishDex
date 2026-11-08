"""Limiter de slowapi en módulo propio para evitar imports circulares entre
`app.main` (que registra el exception handler) y las rutas (que aplican
`@limiter.limit(...)`)."""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import get_settings
from app.core.security import decode_access_token


def client_ip(request: Request) -> str:
    """IP del cliente. Detrás de un proxy inverso todas las peticiones traen
    la IP del proxy: con `TRUST_PROXY_HEADERS=true` se usa la primera IP de
    `X-Forwarded-For` (solo si el proxy la sobrescribe, si no es falsificable)."""
    if get_settings().trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


def user_or_ip(request: Request) -> str:
    """Clave por usuario autenticado (o por IP si no hay token válido). Para
    límites de rutas con sesión: muchos usuarios móviles comparten IP (CGNAT),
    así que limitar por IP castigaría a gente que no tiene nada que ver."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        user_id = decode_access_token(auth[7:].strip())
        if user_id is not None:
            return f"user:{user_id}"
    return f"ip:{client_ip(request)}"


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


limiter = _ConfigAwareLimiter(key_func=client_ip, enabled=get_settings().rate_limit_enabled)
