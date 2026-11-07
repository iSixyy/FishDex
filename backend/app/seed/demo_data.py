"""Datos de ejemplo para el modo `python run.py --render`.

Crea 3 usuarios amigos entre sí, capturas con foto repartidas en la última
semana (para la racha y la franja de días de Inicio), un reto en curso, una
invitación pendiente, un spot compartido y algo de actividad en Comunidad.

Todo pasa por la API real (en proceso, con TestClient): el ELO, los logros y
las rarezas se calculan igual que con capturas de verdad.
"""
import io
import random
from datetime import datetime, timedelta, timezone

from PIL import Image, ImageDraw

DEMO_PASSWORD = "demo12345"
# (usuario, nombre visible). El primero es con el que se entra a probar.
DEMO_USERS = [("samuel", "Samuel García"), ("lucia", "Lucía Martín"), ("pablo", "Pablo Ruiz")]
DEMO_LOGIN_EMAIL = f"{DEMO_USERS[0][0]}@demo.es"

_COLORS = [(170, 175, 185), (210, 170, 70), (120, 150, 110), (190, 110, 90), (150, 160, 200)]
_SPOTS = [(42.55, -8.87), (43.46, -3.80), (41.37, 0.30), (36.53, -6.30), (37.72, -0.78), (41.98, 3.18)]


def _fish_photo(color: tuple[int, int, int], rng: random.Random) -> bytes:
    """Foto sintética: agua con degradado, burbujas y la silueta de un pez."""
    w, h = 800, 600
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(30 + 40 * t), int(90 + 60 * t), int(140 + 50 * t)))
    for _ in range(40):
        x, y, r = rng.randint(0, w), rng.randint(0, h), rng.randint(2, 7)
        d.ellipse([x - r, y - r, x + r, y + r], outline=(200, 230, 250))
    cx, cy = 380, 300
    d.ellipse([cx - 230, cy - 95, cx + 170, cy + 95], fill=color)
    d.polygon([(cx + 150, cy), (cx + 320, cy - 110), (cx + 290, cy), (cx + 320, cy + 110)], fill=color)
    d.polygon([(cx - 40, cy - 90), (cx + 60, cy - 170), (cx + 90, cy - 85)], fill=color)
    d.ellipse([cx - 175, cy - 35, cx - 135, cy + 5], fill=(250, 250, 250))
    d.ellipse([cx - 163, cy - 23, cx - 147, cy - 7], fill=(20, 20, 20))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def demo_data_exists() -> bool:
    from app.database import SessionLocal
    from app.models.user import User

    db = SessionLocal()
    try:
        return db.query(User).filter(User.username == DEMO_USERS[0][0]).first() is not None
    finally:
        db.close()


def load_demo_data() -> None:
    """Carga los datos de ejemplo. Requiere las tablas y el catálogo ya creados."""
    from fastapi.testclient import TestClient

    from app.main import app

    rng = random.Random(7)
    with TestClient(app) as client:
        headers, users = {}, {}
        for username, name in DEMO_USERS:
            response = client.post(
                "/auth/register",
                json={"username": username, "email": f"{username}@demo.es", "password": DEMO_PASSWORD, "display_name": name},
            )
            response.raise_for_status()
            headers[username] = {"Authorization": f"Bearer {response.json()['access_token']}"}
            users[username] = response.json()["user"]

        me = DEMO_USERS[0][0]
        for friend, _ in DEMO_USERS[1:]:
            request = client.post("/friends/request", json={"to_username": friend}, headers=headers[me]).json()
            client.post(f"/friends/accept/{request['id']}", headers=headers[friend])

        catalog = [s["id"] for s in client.get("/fish/catalog", headers=headers[me]).json()]
        now = datetime.now(timezone.utc)
        plan = [  # (usuario, días atrás, índice de especie, kg, cm)
            (me, 0, 0, 3.4, 62), (me, 0, 2, 1.1, 38), (me, 1, 1, 2.2, 48), (me, 2, 3, 0.8, 30),
            (me, 4, 4, 5.6, 80), (me, 6, 0, 4.1, 70), (me, 9, 5, 1.9, 45), (me, 15, 6, 0.6, 28),
            (me, 22, 7, 7.5, 95), ("lucia", 0, 1, 2.9, 52), ("lucia", 1, 8, 3.3, 58),
            ("lucia", 3, 0, 5.2, 78), ("pablo", 0, 9, 1.4, 40), ("pablo", 2, 2, 2.0, 44),
        ]
        for i, (username, days_ago, species_index, kg, cm) in enumerate(plan):
            lat, lon = _SPOTS[i % len(_SPOTS)]
            client.post(
                "/captures",
                headers=headers[username],
                data={
                    "fish_species_id": str(catalog[species_index % len(catalog)]),
                    "weight_kg": str(kg),
                    "length_cm": str(cm),
                    "captured_at": (now - timedelta(days=days_ago, hours=rng.randint(1, 6))).isoformat(),
                    "latitude": str(lat + rng.uniform(-0.05, 0.05)),
                    "longitude": str(lon + rng.uniform(-0.05, 0.05)),
                    "bait_technique": "Vinilo / Spinning",
                },
                files={"image": ("pez.jpg", _fish_photo(_COLORS[i % len(_COLORS)], rng), "image/jpeg")},
            ).raise_for_status()

        duel = client.post(
            "/challenges",
            headers=headers[me],
            json={"friend_ids": [users["lucia"]["id"]], "criterion": "HEAVIEST", "duration_days": 7, "title": "Duelo de la lubina"},
        ).json()
        client.post(f"/challenges/{duel['id']}/respond", headers=headers["lucia"], json={"accept": True})
        client.post(
            "/challenges",
            headers=headers["pablo"],
            json={"friend_ids": [users[me]["id"]], "criterion": "MOST_SPECIES", "duration_days": 3},
        )

        spot = client.post(
            "/spots",
            headers=headers[me],
            json={
                "name": "La roca del faro",
                "notes": "Mejor con marea subiendo y poco viento de levante.",
                "latitude": 43.46,
                "longitude": -3.80,
            },
        ).json()
        client.put(f"/spots/{spot['id']}/shares", headers=headers[me], json={"friend_ids": [users["lucia"]["id"]]})

        feed = client.get("/feed", headers=headers["lucia"]).json()
        for entry in feed[:5]:
            client.post(f"/captures/{entry['id']}/like", headers=headers["lucia"])
        if feed:
            client.post(f"/captures/{feed[0]['id']}/comments", headers=headers["lucia"], json={"text": "¡Menuda pieza!"})
