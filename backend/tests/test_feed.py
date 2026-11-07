from datetime import datetime, timezone

from tests.conftest import register_and_login


def _lubina_species(db_session):
    from app.models.fish_species import FishSpecies

    return db_session.query(FishSpecies).filter(FishSpecies.name == "Lubina").first()


def _capture_form(species_id: int, weight_kg: float = 3.42, length_cm: float = 67.0) -> dict:
    return {
        "fish_species_id": str(species_id),
        "weight_kg": str(weight_kg),
        "length_cm": str(length_cm),
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "latitude": "42.55",
        "longitude": "-8.87",
    }


def _make_friends(client, headers_a, headers_b, username_b) -> None:
    req = client.post("/friends/request", json={"to_username": username_b}, headers=headers_a)
    assert req.status_code == 201
    accept = client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)
    assert accept.status_code == 204


def _register_capture(client, headers, species_id) -> dict:
    response = client.post("/captures", data=_capture_form(species_id), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["capture"]


def test_feed_never_exposes_coordinates_of_other_users(client, db_session):
    headers_a, _ = register_and_login(client, username="ana", email="ana@example.com")
    headers_b, _ = register_and_login(client, username="bruno", email="bruno@example.com")
    _make_friends(client, headers_a, headers_b, "bruno")

    species = _lubina_species(db_session)
    _register_capture(client, headers_b, species.id)

    feed = client.get("/feed", params={"scope": "friends"}, headers=headers_a)
    assert feed.status_code == 200
    body = feed.json()
    assert len(body) >= 1
    for entry in body:
        assert "latitude" not in entry
        assert "longitude" not in entry


def test_like_is_idempotent_and_visible_in_feed(client, db_session):
    headers_a, _ = register_and_login(client, username="carla", email="carla@example.com")
    headers_b, _ = register_and_login(client, username="dario", email="dario@example.com")
    req = client.post("/friends/request", json={"to_username": "dario"}, headers=headers_a)
    client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)

    species = _lubina_species(db_session)
    capture = _register_capture(client, headers_b, species.id)
    capture_id = capture["id"]

    like_1 = client.post(f"/captures/{capture_id}/like", headers=headers_a)
    like_2 = client.post(f"/captures/{capture_id}/like", headers=headers_a)
    assert like_1.status_code == 204
    assert like_2.status_code == 204

    feed = client.get("/feed", params={"scope": "friends"}, headers=headers_a)
    entry = next(e for e in feed.json() if e["id"] == capture_id)
    assert entry["like_count"] == 1
    assert entry["liked_by_me"] is True


def test_unlike_is_idempotent(client, db_session):
    headers_a, _ = register_and_login(client, username="elena", email="elena@example.com")
    headers_b, _ = register_and_login(client, username="fran", email="fran@example.com")
    req = client.post("/friends/request", json={"to_username": "fran"}, headers=headers_a)
    client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)

    species = _lubina_species(db_session)
    capture = _register_capture(client, headers_b, species.id)
    capture_id = capture["id"]

    client.post(f"/captures/{capture_id}/like", headers=headers_a)
    unlike_1 = client.delete(f"/captures/{capture_id}/like", headers=headers_a)
    unlike_2 = client.delete(f"/captures/{capture_id}/like", headers=headers_a)
    assert unlike_1.status_code == 204
    assert unlike_2.status_code == 204

    feed = client.get("/feed", params={"scope": "friends"}, headers=headers_a)
    entry = next(e for e in feed.json() if e["id"] == capture_id)
    assert entry["like_count"] == 0
    assert entry["liked_by_me"] is False


def test_cannot_like_or_comment_capture_of_non_friend(client, db_session):
    headers_a, _ = register_and_login(client, username="gema", email="gema@example.com")
    headers_c, _ = register_and_login(client, username="hugo", email="hugo@example.com")

    species = _lubina_species(db_session)
    capture = _register_capture(client, headers_c, species.id)
    capture_id = capture["id"]

    like = client.post(f"/captures/{capture_id}/like", headers=headers_a)
    comment = client.post(f"/captures/{capture_id}/comments", json={"text": "Menuda pieza"}, headers=headers_a)
    assert like.status_code == 403
    assert comment.status_code == 403


def test_comment_is_created_and_shows_up_in_list_and_feed_count(client, db_session):
    headers_a, _ = register_and_login(client, username="irene", email="irene@example.com")
    headers_b, _ = register_and_login(client, username="julio", email="julio@example.com")
    req = client.post("/friends/request", json={"to_username": "julio"}, headers=headers_a)
    client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)

    species = _lubina_species(db_session)
    capture = _register_capture(client, headers_b, species.id)
    capture_id = capture["id"]

    created = client.post(f"/captures/{capture_id}/comments", json={"text": "Menuda lubina!"}, headers=headers_a)
    assert created.status_code == 201
    assert created.json()["text"] == "Menuda lubina!"

    comments = client.get(f"/captures/{capture_id}/comments", headers=headers_a)
    assert comments.status_code == 200
    assert len(comments.json()) == 1
    assert comments.json()[0]["text"] == "Menuda lubina!"

    feed = client.get("/feed", params={"scope": "friends"}, headers=headers_a)
    entry = next(e for e in feed.json() if e["id"] == capture_id)
    assert entry["comment_count"] == 1


def test_only_comment_author_can_delete_it(client, db_session):
    headers_a, _ = register_and_login(client, username="karla", email="karla@example.com")
    headers_b, _ = register_and_login(client, username="leo", email="leo@example.com")
    req = client.post("/friends/request", json={"to_username": "leo"}, headers=headers_a)
    client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)

    species = _lubina_species(db_session)
    capture = _register_capture(client, headers_b, species.id)
    capture_id = capture["id"]

    created = client.post(f"/captures/{capture_id}/comments", json={"text": "Bonita captura"}, headers=headers_a)
    comment_id = created.json()["id"]

    forbidden = client.delete(f"/comments/{comment_id}", headers=headers_b)
    assert forbidden.status_code == 403

    allowed = client.delete(f"/comments/{comment_id}", headers=headers_a)
    assert allowed.status_code == 204

    comments = client.get(f"/captures/{capture_id}/comments", headers=headers_a)
    assert len(comments.json()) == 0
