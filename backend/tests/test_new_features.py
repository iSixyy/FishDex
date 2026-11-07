"""Funcionalidades nuevas: IA por foto, edición/borrado de capturas, spots,
retos/torneos/eventos, rankings ampliados, normativa, logros por niveles,
vitrina y dispositivos push."""
import io
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image

from app.services.ai_service import FishIdentification, ai_service
from tests.conftest import register_and_login
from tests.test_captures import _capture_form, _lubina_species


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), (20, 90, 160)).save(buffer, format="PNG")
    return buffer.getvalue()


def _ident(**overrides) -> FishIdentification:
    data = dict(
        common_name="Lubina", scientific_name="Dicentrarchus labrax", confidence=0.9,
        estimated_weight_kg=2.4, estimated_length_cm=55.0, water_type="SALT", habitat="Rías",
        region="Cantábrico", catch_difficulty=5, typical_max_weight_kg=7.0, typical_max_length_cm=100.0,
        description="Pez.", fun_fact="Dato.",
    )
    data.update(overrides)
    return FishIdentification(**data)


@pytest.fixture()
def vision(monkeypatch):
    """Simula un modelo de visión disponible que devuelve `result.value`."""

    class Result:
        value: FishIdentification | None = _ident()

    monkeypatch.setattr(ai_service, "is_vision_available", lambda: True)
    monkeypatch.setattr(ai_service, "identify_fish", lambda _raw: Result.value)
    return Result


def _befriend(client, headers_a, headers_b, username_b):
    req = client.post("/friends/request", json={"to_username": username_b}, headers=headers_a)
    client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)


def _upload(client, headers):
    return client.post("/ai/identify", files={"image": ("pez.png", _png(), "image/png")}, headers=headers)


# ---------------------------------------------------------------- IA
def test_identify_without_vision_model_asks_for_manual_input(client):
    headers, _ = register_and_login(client)
    body = _upload(client, headers).json()
    assert body["available"] is False and body["identified"] is False


def test_identify_matches_existing_species_and_estimates(client, vision):
    headers, _ = register_and_login(client)
    body = _upload(client, headers).json()
    assert body["identified"] is True
    assert body["species"]["name"] == "Lubina"
    assert body["species_is_new_in_catalog"] is False
    assert body["estimated_weight_kg"] == 2.4 and body["estimated_length_cm"] == 55.0


def test_new_species_gets_fixed_rarity_from_catch_difficulty(client, vision):
    headers_a, _ = register_and_login(client, username="ana", email="ana@example.com")
    headers_b, _ = register_and_login(client, username="beto", email="beto@example.com")
    vision.value = _ident(common_name="Pez luna", scientific_name="Mola mola", catch_difficulty=9)

    first = _upload(client, headers_a).json()
    assert first["species_is_new_in_catalog"] is True
    assert first["species"]["rarity"] == "LEGENDARY"
    assert first["species"]["origin"] == "AI"

    # Otro usuario, aunque la IA puntúe distinto esta vez, ve la MISMA especie y rareza.
    vision.value = _ident(common_name="Pez luna", scientific_name="Mola mola", catch_difficulty=2)
    second = _upload(client, headers_b).json()
    assert second["species_is_new_in_catalog"] is False
    assert second["species"]["id"] == first["species"]["id"]
    assert second["species"]["rarity"] == "LEGENDARY"


def test_low_confidence_unknown_species_is_not_added(client, vision):
    headers, _ = register_and_login(client)
    vision.value = _ident(common_name="Pez raro", scientific_name="Piscis dubius", confidence=0.3)
    body = _upload(client, headers).json()
    assert body["identified"] is True and body["species"] is None


def test_parse_identification_rejects_absurd_values():
    from app.services.ai_service import parse_identification

    parsed = parse_identification({
        "is_fish": True, "common_name_es": "trucha común", "scientific_name": "salmo TRUTTA",
        "confidence": 5, "estimated_weight_kg": -3, "estimated_length_cm": "40", "catch_difficulty": 42,
        "water_type": "lava",
    })
    assert parsed.common_name == "Trucha común"
    assert parsed.scientific_name == "Salmo trutta"
    assert parsed.estimated_weight_kg is None and parsed.estimated_length_cm == 40.0
    assert parsed.catch_difficulty == 10 and parsed.water_type == "SALT"
    assert parse_identification({"is_fish": False}) is None


# ---------------------------------------------------------------- editar / borrar
def test_edit_capture_recalculates_elo(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    capture = client.post("/captures", data=_capture_form(species.id, weight_kg=2), headers=headers).json()
    elo_before = client.get("/users/me", headers=headers).json()["user"]["elo"]

    # Subir el peso por encima del 90 % del máximo habitual añade el bonus de tamaño.
    edited = client.patch(f"/captures/{capture['capture']['id']}", json={"weight_kg": 6.9}, headers=headers)
    assert edited.status_code == 200, edited.text
    elo_after = client.get("/users/me", headers=headers).json()["user"]["elo"]
    assert elo_after == elo_before + 15


def test_delete_first_capture_promotes_next_to_new_species(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    first = client.post("/captures", data=_capture_form(species.id, weight_kg=2), headers=headers).json()
    second = client.post("/captures", data=_capture_form(species.id, weight_kg=1), headers=headers).json()
    assert second["capture"]["is_new_species"] is False

    assert client.delete(f"/captures/{first['capture']['id']}", headers=headers).status_code == 204
    remaining = client.get("/captures", headers=headers).json()
    assert len(remaining) == 1 and remaining[0]["is_new_species"] is True
    assert client.get("/users/me", headers=headers).json()["user"]["elo"] == remaining[0]["elo_earned"]


def test_cannot_edit_someone_elses_capture(client, db_session):
    headers_a, _ = register_and_login(client, username="carla", email="carla@example.com")
    headers_b, _ = register_and_login(client, username="dani", email="dani@example.com")
    species = _lubina_species(db_session)
    capture = client.post("/captures", data=_capture_form(species.id), headers=headers_a).json()
    assert client.patch(f"/captures/{capture['capture']['id']}", json={"weight_kg": 1}, headers=headers_b).status_code == 404
    assert client.delete(f"/captures/{capture['capture']['id']}", headers=headers_b).status_code == 404


# ---------------------------------------------------------------- spots
def test_spots_are_private_until_shared_with_a_friend(client):
    headers_a, _ = register_and_login(client, username="elena", email="elena@example.com")
    headers_b, user_b = register_and_login(client, username="fede", email="fede@example.com")
    headers_c, user_c = register_and_login(client, username="gema", email="gema@example.com")
    _befriend(client, headers_a, headers_b, "fede")

    spot = client.post("/spots", json={"name": "Mi roca", "latitude": 43.3, "longitude": -2.0}, headers=headers_a)
    assert spot.status_code == 201, spot.text
    spot_id = spot.json()["id"]
    assert client.get("/spots", headers=headers_b).json() == []
    assert client.get(f"/spots/{spot_id}", headers=headers_b).status_code == 404

    assert client.put(f"/spots/{spot_id}/shares", json={"friend_ids": [user_c["id"]]}, headers=headers_a).status_code == 400
    shared = client.put(f"/spots/{spot_id}/shares", json={"friend_ids": [user_b["id"]]}, headers=headers_a)
    assert shared.json()["shared_with"] == [user_b["id"]]

    seen = client.get("/spots", headers=headers_b).json()
    assert [s["id"] for s in seen] == [spot_id] and seen[0]["is_mine"] is False and seen[0]["shared_with"] == []
    assert client.get("/spots", headers=headers_c).json() == []


def test_spot_photos(client):
    headers, _ = register_and_login(client)
    spot_id = client.post("/spots", json={"name": "Pantano", "latitude": 40, "longitude": -3}, headers=headers).json()["id"]
    added = client.post(f"/spots/{spot_id}/photos", files={"image": ("s.png", _png(), "image/png")}, headers=headers)
    assert added.status_code == 201, added.text
    photo_id = added.json()["photos"][0]["id"]
    removed = client.delete(f"/spots/{spot_id}/photos/{photo_id}", headers=headers)
    assert removed.json()["photos"] == []


# ---------------------------------------------------------------- retos
def test_duel_lifecycle_and_winner(client, db_session):
    from app.models.challenge import Challenge

    headers_a, user_a = register_and_login(client, username="hugo", email="hugo@example.com")
    headers_b, user_b = register_and_login(client, username="ines", email="ines@example.com")
    _befriend(client, headers_a, headers_b, "ines")

    created = client.post(
        "/challenges", json={"friend_ids": [user_b["id"]], "criterion": "HEAVIEST", "duration_days": 7}, headers=headers_a
    )
    assert created.status_code == 201, created.text
    challenge = created.json()
    assert challenge["kind"] == "DUEL" and challenge["status"] == "PENDING"

    accepted = client.post(f"/challenges/{challenge['id']}/respond", json={"accept": True}, headers=headers_b).json()
    assert accepted["status"] == "ACTIVE" and accepted["ends_at"] is not None

    species = _lubina_species(db_session)
    client.post("/captures", data=_capture_form(species.id, weight_kg=4), headers=headers_a)
    client.post("/captures", data=_capture_form(species.id, weight_kg=2), headers=headers_b)
    live = client.get(f"/challenges/{challenge['id']}", headers=headers_b).json()
    assert live["participants"][0]["user"]["id"] == user_a["id"] and live["participants"][0]["score"] == 4

    # Se traslada todo al pasado (reto y capturas) para que el reto ya haya
    # vencido con las capturas dentro de su ventana, sin depender del reloj.
    from app.models.capture import Capture

    now = datetime.now(timezone.utc)
    row = db_session.query(Challenge).filter(Challenge.id == challenge["id"]).one()
    row.starts_at, row.ends_at = now - timedelta(hours=3), now - timedelta(hours=1)
    for capture in db_session.query(Capture).all():
        capture.captured_at = capture.created_at = now - timedelta(hours=2)
    db_session.commit()
    finished = client.get(f"/challenges/{challenge['id']}", headers=headers_a).json()
    assert finished["status"] == "FINISHED" and finished["winner"]["id"] == user_a["id"]
    codes = {a["code"] for a in client.get("/achievements", headers=headers_a).json() if a["unlocked"]}
    assert "CHALLENGES_1" in codes


def test_cannot_challenge_non_friends_and_decline_cancels(client):
    headers_a, _ = register_and_login(client, username="juan", email="juan@example.com")
    headers_b, user_b = register_and_login(client, username="kira", email="kira@example.com")
    body = {"friend_ids": [user_b["id"]], "criterion": "MOST_CAPTURES", "duration_days": 3}
    assert client.post("/challenges", json=body, headers=headers_a).status_code == 400

    _befriend(client, headers_a, headers_b, "kira")
    challenge_id = client.post("/challenges", json=body, headers=headers_a).json()["id"]
    declined = client.post(f"/challenges/{challenge_id}/respond", json={"accept": False}, headers=headers_b).json()
    assert declined["status"] == "CANCELLED"


def test_tournament_with_several_friends(client):
    headers_a, _ = register_and_login(client, username="luis", email="luis@example.com")
    friends = []
    for name in ("mar", "noa"):
        headers, user = register_and_login(client, username=name, email=f"{name}@example.com")
        _befriend(client, headers_a, headers, name)
        friends.append(user["id"])
    body = {"friend_ids": friends, "criterion": "MOST_SPECIES", "duration_days": 14, "title": "Liga de otoño"}
    created = client.post("/challenges", json=body, headers=headers_a).json()
    assert created["kind"] == "TOURNAMENT" and created["title"] == "Liga de otoño"
    assert len(created["participants"]) == 3


def test_official_events_only_for_admins_and_anyone_can_join(client):
    headers_user, _ = register_and_login(client, username="olga", email="olga@example.com")
    headers_admin, _ = register_and_login(client, username="admin", email="admin@example.com")
    body = {"title": "Gran Liga de Lubina", "criterion": "HEAVIEST", "duration_days": 30}
    assert client.post("/challenges/events", json=body, headers=headers_user).status_code == 403

    event = client.post("/challenges/events", json=body, headers=headers_admin)
    assert event.status_code == 201 and event.json()["status"] == "ACTIVE"
    listed = client.get("/challenges", headers=headers_user).json()
    assert any(c["id"] == event.json()["id"] and c["my_status"] is None for c in listed)
    joined = client.post(f"/challenges/{event.json()['id']}/join", headers=headers_user).json()
    assert joined["my_status"] == "ACCEPTED"


# ---------------------------------------------------------------- rankings
def test_global_region_and_species_rankings(client, db_session):
    headers_a, user_a = register_and_login(client, username="pepe", email="pepe@example.com")
    headers_b, _ = register_and_login(client, username="quim", email="quim@example.com")
    species = _lubina_species(db_session)
    client.post("/captures", data=_capture_form(species.id, weight_kg=5), headers=headers_a)
    client.post("/captures", data=_capture_form(species.id, weight_kg=3), headers=headers_b)

    global_page = client.get("/ranking/global", headers=headers_b).json()
    assert global_page["me"]["position"] >= 1 and len(global_page["entries"]) == 2

    by_species = client.get(f"/ranking/species/{species.id}", headers=headers_b).json()
    assert by_species["entries"][0]["user"]["id"] == user_a["id"] and by_species["entries"][0]["value"] == 5
    assert by_species["me"]["position"] == 2

    assert "Galicia" in client.get("/ranking/regions", headers=headers_a).json()
    region = client.get("/ranking/region/Galicia", headers=headers_a).json()
    assert len(region["entries"]) == 2
    assert client.get("/ranking/global?limit=1&offset=1", headers=headers_a).json()["entries"][0]["position"] == 2


# ---------------------------------------------------------------- normativa
def test_regulation_check_warns_below_min_length(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    body = client.get(f"/regulations/check?species_id={species.id}&length_cm=30", headers=headers).json()
    assert body["has_data"] is True
    assert any(w["kind"] == "MIN_LENGTH" and w["severity"] == "danger" for w in body["warnings"])
    ok = client.get(f"/regulations/check?species_id={species.id}&length_cm=50", headers=headers).json()
    assert all(w["severity"] == "info" for w in ok["warnings"])


def test_closed_season_window_crossing_new_year():
    from datetime import date

    from app.services.regulation_service import _in_closed_season

    assert _in_closed_season("11-01", "03-15", date(2026, 1, 10))
    assert not _in_closed_season("11-01", "03-15", date(2026, 6, 10))
    assert _in_closed_season("04-01", "06-30", date(2026, 5, 1))


# ---------------------------------------------------------------- logros / vitrina / push
def test_forty_tiered_achievements_and_showcase(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    client.post("/captures", data=_capture_form(species.id, weight_kg=5.5), headers=headers)

    achievements = client.get("/achievements", headers=headers).json()
    assert len(achievements) == 40
    assert {a["tier"] for a in achievements} == {"BRONZE", "SILVER", "GOLD"}
    unlocked = [a["code"] for a in achievements if a["unlocked"]]
    assert {"FIRST_CATCH", "HEAVY_5KG", "LONG_50CM"} <= set(unlocked)

    profile = client.get("/users/me", headers=headers).json()
    assert 1 <= len(profile["showcase"]) <= 3
    chosen = client.put("/users/me/showcase", json={"codes": ["HEAVY_5KG", "SPECIES_50"]}, headers=headers).json()
    assert [b["code"] for b in chosen["showcase"]] == ["HEAVY_5KG"]  # SPECIES_50 no está desbloqueado


def test_friend_can_see_badges_stranger_cannot(client):
    headers_a, user_a = register_and_login(client, username="rita", email="rita@example.com")
    headers_b, _ = register_and_login(client, username="sara", email="sara@example.com")
    assert client.get(f"/users/{user_a['id']}/achievements", headers=headers_b).status_code == 403
    _befriend(client, headers_a, headers_b, "sara")
    assert client.get(f"/users/{user_a['id']}/achievements", headers=headers_b).status_code == 200


def test_device_token_registration(client, db_session):
    from app.models.device import DeviceToken

    headers, _ = register_and_login(client)
    token = "ExponentPushToken[abcdefghijk]"
    assert client.post("/devices", json={"token": token, "platform": "android"}, headers=headers).status_code == 204
    assert client.post("/devices", json={"token": token, "platform": "android"}, headers=headers).status_code == 204
    assert db_session.query(DeviceToken).count() == 1
    client.post("/devices/unregister", json={"token": token}, headers=headers)
    assert db_session.query(DeviceToken).count() == 0


def test_moon_phase_is_computed_locally():
    from app.services.weather_service import moon_phase

    full_moon = moon_phase(datetime(2024, 1, 25, 18, 0, tzinfo=timezone.utc))
    assert full_moon["name"] == "Luna llena" and full_moon["illumination"] > 0.95
