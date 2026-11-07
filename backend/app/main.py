import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.concurrency import run_in_threadpool

from app.api.routes import (
    achievements,
    ai,
    auth,
    captures,
    challenges,
    config,
    devices,
    feed,
    fish,
    friends,
    map as map_routes,
    quotes,
    ranking,
    regulations,
    social,
    spots,
    users,
    weather,
)
from app.config import get_settings
from app.core.rate_limit import limiter
from app.database import SessionLocal, init_db

logger = logging.getLogger("fishdex")

SCHEDULER_INTERVAL_SECONDS = 10 * 60

settings = get_settings()

# Se crea aquí, a nivel de módulo, porque `StaticFiles` comprueba que el
# directorio existe en el momento de construirse (más abajo), y eso ocurre al
# IMPORTAR este módulo, antes de que `lifespan()` llegue a ejecutarse. En un
# clon nuevo sin `storage/`, dejar la creación solo en `lifespan` hacía que
# Starlette lanzara `RuntimeError: Directory does not exist` al importar.
Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)


def _sync_reference_data() -> None:
    """Los logros viven en código (app/core/achievements.py): se sincronizan
    al arrancar para que un despliegue nuevo no dependa de relanzar el seed."""
    from app.seed.seed_data import seed_achievements

    db = SessionLocal()
    try:
        seed_achievements(db)
        db.commit()
    finally:
        db.close()


def _run_scheduled_jobs() -> None:
    from app.services import challenge_service

    db = SessionLocal()
    try:
        challenge_service.run_scheduled(db)
    finally:
        db.close()


async def _scheduler_loop() -> None:
    """Cierra retos vencidos y avisa de los que están a punto de acabar."""
    while True:
        try:
            await run_in_threadpool(_run_scheduled_jobs)
        except Exception:  # un fallo puntual no debe matar el bucle
            logger.exception("Fallo en la tarea programada de retos")
        await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    _sync_reference_data()
    task = asyncio.create_task(_scheduler_loop()) if settings.scheduler_enabled else None
    yield
    if task is not None:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="FishDex API",
    description="Backend de FishDex: la Pokédex para pescadores en España.",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# `allow_credentials=True` con `allow_origins=["*"]` es peligroso: Starlette
# refleja el `Origin` de la petición y añade `Access-Control-Allow-Credentials:
# true`, lo que permite a CUALQUIER origen hacer peticiones con credenciales.
# La app solo usa cabecera `Authorization: Bearer` (nunca cookies), así que
# con comodín desactivamos credentials; con una lista explícita de orígenes sí
# se permiten, porque entonces el reflejo ya no es indiscriminado.
_cors_is_wildcard = settings.cors_origin_list == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=not _cors_is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=settings.storage_dir), name="media")

app.include_router(auth.router)
app.include_router(fish.router)
app.include_router(users.router)
app.include_router(captures.router)
app.include_router(map_routes.router)
app.include_router(friends.router)
app.include_router(ranking.router)
app.include_router(quotes.router)
app.include_router(achievements.router)
app.include_router(config.router)
app.include_router(feed.router)
app.include_router(social.router)
app.include_router(ai.router)
app.include_router(weather.router)
app.include_router(spots.router)
app.include_router(challenges.router)
app.include_router(devices.router)
app.include_router(regulations.router)


@app.get("/", tags=["health"])
def health_check() -> dict:
    return {"status": "ok", "app": "FishDex API"}
