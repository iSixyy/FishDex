"""Regresiones de los errores corregidos en la revisión de arquitectura."""
from datetime import datetime, timedelta, timezone

from tests.conftest import register_and_login
from tests.test_captures import _capture_form, _lubina_species


def _befriend(client, headers_a, headers_b, username_b):
    req = client.post("/friends/request", json={"to_username": username_b}, headers=headers_a)
    assert req.status_code == 201, req.text
    client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)
    return req.json()["id"]


def test_can_resend_friend_request_after_rejection_cooldown(client, db_session):
    from app.models.friend import FriendRequest

    headers_a, _ = register_and_login(client, username="marta", email="marta@example.com")
    headers_b, _ = register_and_login(client, username="nico", email="nico@example.com")

    first = client.post("/friends/request", json={"to_username": "nico"}, headers=headers_a)
    client.post(f"/friends/reject/{first.json()['id']}", headers=headers_b)

    # Reenviar al instante (spam de avisos) no se permite...
    too_soon = client.post("/friends/request", json={"to_username": "nico"}, headers=headers_a)
    assert too_soon.status_code == 409

    # ...pero pasada la espera, sí.
    request = db_session.get(FriendRequest, first.json()["id"])
    request.created_at = datetime.now(timezone.utc) - timedelta(seconds=31)
    db_session.commit()
    again = client.post("/friends/request", json={"to_username": "NICO"}, headers=headers_a)
    assert again.status_code == 201, again.text
    pending = client.get("/friends/requests", headers=headers_b).json()
    assert [r["id"] for r in pending] == [again.json()["id"]]


def test_can_befriend_again_after_removing_friend(client):
    headers_a, _ = register_and_login(client, username="olga", email="olga@example.com")
    headers_b, user_b = register_and_login(client, username="pablo", email="pablo@example.com")

    _befriend(client, headers_a, headers_b, "pablo")
    assert client.delete(f"/friends/{user_b['id']}", headers=headers_a).status_code == 204

    _befriend(client, headers_a, headers_b, "pablo")
    assert len(client.get("/friends", headers=headers_a).json()) == 1


def test_capture_retry_with_same_client_id_is_idempotent(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    form = {**_capture_form(species.id), "client_id": "abc-123"}

    first = client.post("/captures", data=form, headers=headers)
    retry = client.post("/captures", data=form, headers=headers)

    assert first.status_code == 201, first.text
    assert retry.status_code == 201, retry.text
    assert retry.json()["capture"]["id"] == first.json()["capture"]["id"]
    assert retry.json()["total_elo"] == first.json()["total_elo"]
    assert len(client.get("/captures", headers=headers).json()) == 1


def test_client_id_is_scoped_per_user(client, db_session):
    headers_a, _ = register_and_login(client, username="quique", email="quique@example.com")
    headers_b, _ = register_and_login(client, username="rosa", email="rosa@example.com")
    species = _lubina_species(db_session)
    form = {**_capture_form(species.id), "client_id": "same-id"}

    a = client.post("/captures", data=form, headers=headers_a)
    b = client.post("/captures", data=form, headers=headers_b)
    assert a.status_code == b.status_code == 201
    assert a.json()["capture"]["id"] != b.json()["capture"]["id"]


def test_far_away_capture_is_not_attributed_to_spanish_location(client, db_session):
    from app.models.capture import Capture

    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    form = {**_capture_form(species.id), "latitude": "48.85", "longitude": "2.35"}  # París

    response = client.post("/captures", data=form, headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()["capture"]["location_name"] is None
    capture = db_session.query(Capture).filter(Capture.id == response.json()["capture"]["id"]).one()
    assert capture.autonomous_community is None


def test_achievement_unlocked_at_is_serialized_as_utc(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    client.post("/captures", data=_capture_form(species.id), headers=headers)

    unlocked = [a for a in client.get("/achievements", headers=headers).json() if a["unlocked"]]
    assert unlocked
    parsed = datetime.fromisoformat(unlocked[0]["unlocked_at"])
    assert parsed.utcoffset() == timezone.utc.utcoffset(None)
