"""Punto de entrada de desarrollo.

    python run.py                  # backend normal (usa backend/.env y fishdex.db)
    python run.py --web            # backend normal + app en el navegador (Metro), con TUS datos
    python run.py --render         # demo completa: API + app en el navegador (Metro)
    python run.py --render --reset # igual, pero borrando y regenerando la demo
    python run.py --render --no-web      # solo la API de demo, sin Metro
    python run.py --render --no-browser  # API + Metro, sin abrir el navegador

Modo --render: arranca la API en local (http://localhost:8000) con una base de
datos APARTE (backend/demo/) llena de datos de ejemplo, así que nunca toca tu
fishdex.db. Además lanza Metro (`expo start --web`) desde mobile/ y abre la app
en el navegador en cuanto el primer bundle está listo. Ctrl+C lo para todo.

Modo --web: lo mismo, pero con el backend normal (tu fishdex.db y tu .env),
para usar la app en el navegador con tus cuentas y capturas reales.
"""
import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEMO_DIR = BASE_DIR / "demo"
MOBILE_DIR = BASE_DIR.parent / "mobile"
WEB_READY_TIMEOUT_SECONDS = 300  # el primer bundle de Metro puede tardar un rato


def _configure_render_mode(reset: bool) -> None:
    """Fija la configuración del modo demo ANTES de importar la app: los
    ajustes se leen (y se cachean) en el primer import de `app.config`."""
    if reset and DEMO_DIR.exists():
        shutil.rmtree(DEMO_DIR)
    (DEMO_DIR / "storage").mkdir(parents=True, exist_ok=True)
    os.environ.update(
        {
            "DATABASE_URL": f"sqlite:///{(DEMO_DIR / 'fishdex_demo.db').as_posix()}",
            "STORAGE_DIR": str(DEMO_DIR / "storage"),
            # El navegador usa otro origen (localhost:8081): CORS abierto en local.
            "CORS_ORIGINS": "*",
            # Sin límites de /auth para poder registrar y probar cuentas a gusto.
            "RATE_LIMIT_ENABLED": "false",
            # En el navegador no hay notificaciones push de Expo.
            "PUSH_ENABLED": "false",
            # El usuario de demo puede crear eventos oficiales.
            "ADMIN_USERNAMES": "samuel",
            "ENVIRONMENT": "development",
        }
    )


def _prepare_demo_database() -> None:
    from app.seed.demo_data import demo_data_exists, load_demo_data
    from app.seed.seed_data import run_seed

    run_seed()  # tablas + catálogo de especies, logros, ubicaciones y frases (idempotente)
    if demo_data_exists():
        print("Datos de demo ya cargados (usa --reset para regenerarlos).", flush=True)
    else:
        print("Cargando datos de demo (usuarios, capturas con foto, retos, spot)...", flush=True)
        load_demo_data()


def _describe_database(url: str) -> str:
    """Ruta de la BD para mostrarla al arrancar, sin credenciales."""
    if url.startswith("sqlite"):
        return url.split(":///", 1)[-1]
    from sqlalchemy.engine import make_url

    return make_url(url).render_as_string(hide_password=True)


def _print_banner(api_port: int, web_port: int | None, demo: bool, database_url: str) -> None:
    from app.seed.demo_data import DEMO_LOGIN_EMAIL, DEMO_PASSWORD

    print(flush=True)
    label = "API de demo  " if demo else "API (tus datos)"
    print(f"  {label} -> http://localhost:{api_port}  (documentación: /docs)")
    print(f"  Base de datos -> {_describe_database(database_url)}")
    if web_port:
        print(f"  App (Metro)   -> http://localhost:{web_port}  (el primer arranque tarda un poco)")
    else:
        print("  App: abre otra terminal y ejecuta  cd mobile && npm run web")
    if demo:
        print(f"  Usuario demo  -> {DEMO_LOGIN_EMAIL} / {DEMO_PASSWORD}")
        print("  (tus cuentas reales NO están aquí: para usarlas, arranca con  python run.py --web)")
    else:
        print("  Entra con tu cuenta de siempre (base de datos: la de backend/.env).")
    print("  Ctrl+C para pararlo todo.")
    print(flush=True)


def _start_metro(api_port: int, web_port: int) -> subprocess.Popen | None:
    """Lanza `expo start --web` en mobile/. Devuelve None si no se puede."""
    npx = shutil.which("npx")
    if npx is None:
        print("  [web] No se encuentra `npx` (Node.js). Se arranca solo la API.", flush=True)
        return None
    if not (MOBILE_DIR / "node_modules").exists():
        print("  [web] Falta mobile/node_modules: ejecuta `cd mobile && npm install`. Se arranca solo la API.", flush=True)
        return None
    env = {
        **os.environ,
        # La app web llama a esta API (ver mobile/src/constants/config.ts).
        "EXPO_PUBLIC_WEB_API_URL": f"http://localhost:{api_port}",
        # El navegador lo abrimos nosotros cuando el bundle está listo, no Expo
        # al arrancar (se vería una pestaña en blanco durante la compilación).
        "BROWSER": "none",
        # Silencia el aviso de la API key de Google Maps (no aplica en web).
        "FISHDEX_WEB_PREVIEW": "1",
    }
    return subprocess.Popen([npx, "expo", "start", "--web", "--port", str(web_port)], cwd=MOBILE_DIR, env=env)


def _open_browser_when_ready(url: str) -> None:
    """Espera a que Metro sirva la app y a que la API responda, y abre el
    navegador. Se ejecuta en segundo plano para no bloquear el arranque."""
    deadline = time.monotonic() + WEB_READY_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200:
                    print(f"  [web] App lista -> abriendo {url}", flush=True)
                    webbrowser.open(url)
                    return
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(2)
    print(f"  [web] Metro tarda demasiado; abre {url} a mano cuando termine.", flush=True)


def _stop_process_tree(process: subprocess.Popen | None) -> None:
    """`npx` lanza node como hijo: hay que cerrar todo el árbol, no solo npx."""
    if process is None or process.poll() is not None:
        return
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Arranca el backend de FishDex.")
    parser.add_argument("--web", action="store_true", help="backend normal (tus datos) + app en el navegador")
    parser.add_argument("--render", action="store_true", help="demo local: API con datos de ejemplo + app en el navegador")
    parser.add_argument("--reset", action="store_true", help="con --render: borra la demo y la regenera")
    parser.add_argument("--no-web", action="store_true", help="con --render: no lanzar Metro (solo la API)")
    parser.add_argument("--no-browser", action="store_true", help="con --web/--render: no abrir el navegador automáticamente")
    parser.add_argument("--web-port", type=int, default=8081, help="puerto de Metro para la app web (por defecto 8081)")
    args = parser.parse_args()

    if args.render:
        _configure_render_mode(args.reset)

    import uvicorn

    from app.config import get_settings

    settings = get_settings()
    metro = None
    if args.render:
        _prepare_demo_database()
    elif args.web:
        from app.seed.seed_data import run_seed

        # Garantiza tablas y catálogo (idempotente: nunca toca usuarios ni capturas).
        run_seed()
    if args.render or args.web:
        if not args.no_web:
            metro = _start_metro(settings.api_port, args.web_port)
            if metro is not None and not args.no_browser:
                threading.Thread(
                    target=_open_browser_when_ready, args=(f"http://localhost:{args.web_port}",), daemon=True
                ).start()
        _print_banner(settings.api_port, args.web_port if metro is not None else None, demo=args.render, database_url=settings.database_url)

    try:
        # Las variables de entorno fijadas arriba las hereda el proceso hijo de `reload`.
        uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port, reload=True)
    finally:
        _stop_process_tree(metro)
