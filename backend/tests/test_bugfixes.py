"""Regresiones de los bugs corregidos en la auditoría completa de la app."""
import io
from datetime import datetime, timedelta, timezone

from PIL import Image

from tests.conftest import register_and_login
from tests.test_captures import _capture_form, _lubina_species
from tests.test_new_features import _befriend, _ident, _upload, vision  # noqa: F401 (fixture)


def _form(species_id, *, weight_kg=3.0, length_cm=60.0, captured_at=None, **extra):
    form = _capture_form(species_id, weight_kg=weight_kg, length_cm=length_cm)
    if captured_at is not None:
        form["captured_at"] = captured_at.isoformat()
    form.update(extra)
    return form


# ------------------------------------------------------------ cuentas
def test_username_and_email_are_case_insensitive(client):
    register_and_login(client, username="admin", email="admin@example.com")
    clash = client.post(
        "/auth/register",
        json={"username": "ADMIN", "email": "otro@example.com", "password": "contraseña123", "display_name": "Falso"},
    )
    assert clash.status_code == 409  # ya no se puede heredar el rol de admin cambiando mayúsculas

    register_and_login(client, username="pepa", email="Pepa@Example.com")
    clash_email = client.post(
        "/auth/register",
        json={"username": "pepa2", "email": "PEPA@example.com", "password": "contraseña123", "display_name": "Pepa"},
    )
    assert clash_email.status_code == 409
    login = client.post("/auth/login", json={"email": "PEPA@EXAMPLE.COM", "password": "contraseña123"})
    assert login.status_code == 200, login.text


def test_logout_revokes_existing_tokens(client):
    headers, _ = register_and_login(client)
    assert client.get("/users/me", headers=headers).status_code == 200
    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/users/me", headers=headers).status_code == 401

    fresh = client.post("/auth/login", json={"email": "pescador1@example.com", "password": "contraseña123"})
    new_headers = {"Authorization": f"Bearer {fresh.json()['access_token']}"}
    assert client.get("/users/me", headers=new_headers).status_code == 200


def test_device_can_be_unregistered_without_a_valid_session(client, db_session):
    from app.models.device import DeviceToken

    headers, _ = register_and_login(client)
    token = "ExponentPushToken[zyxwvutsrqp]"
    client.post("/devices", json={"token": token}, headers=headers)
    expired = {"Authorization": "Bearer token-caducado"}
    assert client.post("/devices/unregister", json={"token": token}, headers=expired).status_code == 204
    assert db_session.query(DeviceToken).count() == 0


def test_blank_display_name_and_spot_name_are_rejected(client):
    blank = client.post(
        "/auth/register",
        json={"username": "blanco", "email": "blanco@example.com", "password": "contraseña123", "display_name": "   "},
    )
    assert blank.status_code == 422
    headers, _ = register_and_login(client)
    spot = client.post("/spots", json={"name": "   ", "latitude": 40, "longitude": -3}, headers=headers)
    assert spot.status_code == 422


# ------------------------------------------------------------ capturas
def test_implausible_measures_are_rejected_on_create_and_edit(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)  # máximo habitual: 7 kg / 100 cm
    huge = client.post("/captures", data=_form(species.id, weight_kg=500), headers=headers)
    assert huge.status_code == 422 and "realista" in huge.json()["detail"]

    ok = client.post("/captures", data=_form(species.id, weight_kg=12), headers=headers)  # récord real: válido
    assert ok.status_code == 201, ok.text
    edited = client.patch(f"/captures/{ok.json()['capture']['id']}", json={"length_cm": 900}, headers=headers)
    assert edited.status_code == 422


def test_capture_counting_in_a_challenge_cannot_change_its_measures(client, db_session):
    headers_a, _ = register_and_login(client, username="rita", email="rita@example.com")
    headers_b, user_b = register_and_login(client, username="saul", email="saul@example.com")
    _befriend(client, headers_a, headers_b, "saul")
    challenge = client.post(
        "/challenges", json={"friend_ids": [user_b["id"]], "criterion": "HEAVIEST", "duration_days": 7}, headers=headers_a
    ).json()
    client.post(f"/challenges/{challenge['id']}/respond", json={"accept": True}, headers=headers_b)

    capture_id = client.post("/captures", data=_form(_lubina_species(db_session).id), headers=headers_a).json()["capture"]["id"]
    locked = client.patch(f"/captures/{capture_id}", json={"weight_kg": 6.5}, headers=headers_a)
    assert locked.status_code == 409
    # Lo que no afecta a la puntuación sí se puede corregir.
    assert client.patch(f"/captures/{capture_id}", json={"bait_technique": "Vinilo"}, headers=headers_a).status_code == 200


def test_daily_elo_limit_counts_the_day_the_fish_was_caught(client, db_session):
    """Pescar 3 días sin cobertura y sincronizar de golpe ya no hace perder ELO."""
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    two_days_ago = datetime.now(timezone.utc) - timedelta(days=2)
    for i in range(3):
        client.post("/captures", data=_form(species.id, captured_at=two_days_ago - timedelta(minutes=i)), headers=headers)
    today = client.post("/captures", data=_form(species.id), headers=headers).json()
    assert today["elo_earned"] > 0  # antes: 0, porque las 4 "llegaban" el mismo día

    blocked = client.post("/captures", data=_form(species.id, captured_at=two_days_ago - timedelta(minutes=10)), headers=headers)
    assert blocked.json()["elo_earned"] == 0  # la 4ª del MISMO día de pesca sí queda limitada


def test_weather_snapshot_only_for_recent_captures(client, db_session, monkeypatch):
    from app.services import weather_service

    monkeypatch.setattr(weather_service, "get_conditions", lambda lat, lon: {"summary": "Despejado", "tides": []})
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    recent = client.post("/captures", data=_form(species.id), headers=headers).json()
    assert recent["capture"]["weather"] == {"summary": "Despejado", "tides": []}

    old = client.post(
        "/captures", data=_form(species.id, captured_at=datetime.now(timezone.utc) - timedelta(days=1)), headers=headers
    ).json()
    assert old["capture"]["weather"] is None


def test_oversized_image_is_rejected_before_decoding(client, db_session):
    headers, _ = register_and_login(client)
    buffer = io.BytesIO()
    Image.new("1", (7000, 6000)).save(buffer, format="PNG")  # 42 Mpx, pocos KB
    response = client.post(
        "/captures",
        data=_form(_lubina_species(db_session).id),
        files={"image": ("enorme.png", buffer.getvalue(), "image/png")},
        headers=headers,
    )
    assert response.status_code == 400


# ------------------------------------------------------------ IA
def test_ai_rejects_non_binomial_names_and_caps_new_species_per_day(client, vision):  # noqa: F811
    headers, _ = register_and_login(client)
    vision.value = _ident(common_name="Pez", scientific_name="Desconocido")
    assert _upload(client, headers).json()["species"] is None

    created = []
    for i, genus in enumerate(["Alpha", "Beta", "Gamma", "Delta"]):
        vision.value = _ident(common_name=f"Pez {i}", scientific_name=f"{genus} piscis", catch_difficulty=10)
        created.append(_upload(client, headers).json())
    assert [c["species_is_new_in_catalog"] for c in created] == [True, True, True, False]
    assert all(c["species"]["rarity"] == "RARE" for c in created[:3])  # nunca MÍTICA por decirlo la IA
    assert created[3]["species"] is None


# ------------------------------------------------------------ retos
def _duel(client, db_session, duration_days=7):
    headers_a, user_a = register_and_login(client, username="tere", email="tere@example.com")
    headers_b, user_b = register_and_login(client, username="ugo", email="ugo@example.com")
    _befriend(client, headers_a, headers_b, "ugo")
    challenge = client.post(
        "/challenges",
        json={"friend_ids": [user_b["id"]], "criterion": "MOST_CAPTURES", "duration_days": duration_days},
        headers=headers_a,
    ).json()
    return headers_a, headers_b, challenge


def test_creator_can_cancel_pending_but_not_active_duel(client, db_session):
    headers_a, headers_b, challenge = _duel(client, db_session)
    client.post(f"/challenges/{challenge['id']}/respond", json={"accept": True}, headers=headers_b)
    assert client.delete(f"/challenges/{challenge['id']}", headers=headers_a).status_code == 409

    other = client.post(
        "/challenges",
        json={"friend_ids": [challenge["participants"][1]["user"]["id"]], "criterion": "HEAVIEST", "duration_days": 3},
        headers=headers_a,
    ).json()
    assert client.delete(f"/challenges/{other['id']}", headers=headers_a).status_code == 204


def test_finalize_is_claimed_only_once(client, db_session, monkeypatch):
    from app.models.challenge import Challenge, ChallengeStatus
    from app.services import challenge_service, notification_service

    _, headers_b, challenge = _duel(client, db_session)
    client.post(f"/challenges/{challenge['id']}/respond", json={"accept": True}, headers=headers_b)
    row = db_session.get(Challenge, challenge["id"])
    now = datetime.now(timezone.utc)
    row.starts_at, row.ends_at = now - timedelta(days=2), now - timedelta(hours=1)
    db_session.commit()

    sent = []
    monkeypatch.setattr(notification_service, "notify_users", lambda *args, **kwargs: sent.append(args))
    # Otro proceso ya lo ha cerrado, pero este objeto aún lo ve ACTIVO en memoria.
    db_session.query(Challenge).filter(Challenge.id == row.id).update(
        {Challenge.status: ChallengeStatus.FINISHED}, synchronize_session=False
    )
    assert challenge_service.finalize_if_due(db_session, row) is False
    assert sent == []  # nada de un segundo aviso de "ha terminado"


def test_one_day_challenge_gets_no_last_day_warning(client, db_session, monkeypatch):
    from app.services import challenge_service, notification_service

    _, headers_b, challenge = _duel(client, db_session, duration_days=1)
    client.post(f"/challenges/{challenge['id']}/respond", json={"accept": True}, headers=headers_b)
    sent = []
    monkeypatch.setattr(notification_service, "notify_users", lambda *args, **kwargs: sent.append(args[2]))
    challenge_service.run_scheduled(db_session)
    assert "¡Último día!" not in sent


# ------------------------------------------------------------ amigos
def test_mutual_friend_request_becomes_friendship(client):
    headers_a, _ = register_and_login(client, username="vera", email="vera@example.com")
    headers_b, _ = register_and_login(client, username="wil", email="wil@example.com")
    assert client.post("/friends/request", json={"to_username": "wil"}, headers=headers_a).status_code == 201
    # Antes: 409 "Ya existe una solicitud pendiente". Ahora equivale a aceptar.
    assert client.post("/friends/request", json={"to_username": "Vera"}, headers=headers_b).status_code == 201
    assert len(client.get("/friends", headers=headers_a).json()) == 1
    assert client.get("/friends/requests", headers=headers_b).json() == []
