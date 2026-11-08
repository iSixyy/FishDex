"""Funciones de cuenta y comunidad: borrar cuenta, contraseña, perfil y
avatar, bloquear/reportar, temporadas, previsión de picada, captura y suelta,
mapa de calor y licencia de pesca."""
from datetime import date, datetime, timedelta, timezone

from tests.conftest import register_and_login
from tests.test_captures import _capture_form, _lubina_species
from tests.test_new_features import _befriend, _png


# ------------------------------------------------------------ borrar cuenta
def test_delete_account_removes_all_user_data(client, db_session):
    from app.models.capture import Capture
    from app.models.friend import Friend
    from app.models.social import CaptureComment
    from app.models.spot import Spot
    from app.models.user import User

    headers_a, user_a = register_and_login(client, username="ana", email="ana@example.com")
    headers_b, user_b = register_and_login(client, username="beto", email="beto@example.com")
    _befriend(client, headers_a, headers_b, "beto")
    species = _lubina_species(db_session)
    capture_b = client.post("/captures", data=_capture_form(species.id), headers=headers_b).json()["capture"]["id"]
    capture_a = client.post(
        "/captures", data=_capture_form(species.id), files={"image": ("p.png", _png(), "image/png")}, headers=headers_a
    ).json()["capture"]["id"]
    client.post(f"/captures/{capture_b}/comments", json={"text": "¡Buena!"}, headers=headers_a)
    client.post(f"/captures/{capture_a}/like", headers=headers_b)
    client.post("/spots", json={"name": "Roca", "latitude": 43, "longitude": -8}, headers=headers_a)
    client.post(
        "/challenges", json={"friend_ids": [user_b["id"]], "criterion": "HEAVIEST", "duration_days": 3}, headers=headers_a
    )

    assert client.request("DELETE", "/users/me", json={"password": "mala"}, headers=headers_a).status_code == 400
    assert client.request("DELETE", "/users/me", json={"password": "contraseña123"}, headers=headers_a).status_code == 204

    assert db_session.get(User, user_a["id"]) is None
    assert db_session.query(Capture).filter(Capture.user_id == user_a["id"]).count() == 0
    assert db_session.query(CaptureComment).filter(CaptureComment.user_id == user_a["id"]).count() == 0
    assert db_session.query(Friend).count() == 0
    assert db_session.query(Spot).count() == 0
    assert client.get("/users/me", headers=headers_a).status_code == 401
    # La otra cuenta sigue funcionando con normalidad.
    assert client.get("/challenges", headers=headers_b).json() == []
    assert len(client.get("/captures", headers=headers_b).json()) == 1


# ------------------------------------------------------------ contraseña
def test_change_password_rotates_sessions(client):
    headers, _ = register_and_login(client)
    wrong = client.post("/auth/password/change", json={"current_password": "x", "new_password": "nueva12345"}, headers=headers)
    assert wrong.status_code == 400
    ok = client.post(
        "/auth/password/change", json={"current_password": "contraseña123", "new_password": "nueva12345"}, headers=headers
    )
    assert ok.status_code == 200
    assert client.get("/users/me", headers=headers).status_code == 401  # el token antiguo ya no vale
    new_headers = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    assert client.get("/users/me", headers=new_headers).status_code == 200
    assert client.post("/auth/login", json={"email": "pescador1@example.com", "password": "nueva12345"}).status_code == 200


def test_forgot_and_reset_password_with_emailed_code(client, monkeypatch):
    from app.services import email_service

    sent = []
    monkeypatch.setattr(email_service, "send_email", lambda to, subject, body: sent.append(body))
    register_and_login(client)
    assert client.post("/auth/password/forgot", json={"email": "nadie@example.com"}).status_code == 204
    assert sent == []  # no revela si el email existe, pero no envía nada
    assert client.post("/auth/password/forgot", json={"email": "PESCADOR1@example.com"}).status_code == 204
    code = next(word.rstrip(".") for word in sent[0].split() if word.rstrip(".").isdigit() and len(word.rstrip(".")) == 6)

    bad = client.post("/auth/password/reset", json={"email": "pescador1@example.com", "code": "000000" if code != "000000" else "111111", "new_password": "otra123456"})
    assert bad.status_code == 400
    good = client.post("/auth/password/reset", json={"email": "pescador1@example.com", "code": code, "new_password": "otra123456"})
    assert good.status_code == 200 and good.json()["access_token"]
    reused = client.post("/auth/password/reset", json={"email": "pescador1@example.com", "code": code, "new_password": "otra999999"})
    assert reused.status_code == 400  # el código es de un solo uso


# ------------------------------------------------------------ perfil y avatar
def test_edit_profile_and_avatar(client):
    headers, _ = register_and_login(client)
    edited = client.patch("/users/me", json={"display_name": "  Capitán Pescanova  "}, headers=headers)
    assert edited.json()["user"]["display_name"] == "Capitán Pescanova"
    with_avatar = client.post("/users/me/avatar", files={"image": ("a.png", _png(), "image/png")}, headers=headers)
    assert with_avatar.status_code == 200, with_avatar.text
    assert with_avatar.json()["user"]["avatar"].startswith("/media/avatars/")
    assert client.post("/users/me/avatar", files={"image": ("a.txt", b"no", "image/png")}, headers=headers).status_code == 400
    assert client.delete("/users/me/avatar", headers=headers).json()["user"]["avatar"] is None


# ------------------------------------------------------------ bloquear y reportar
def test_block_user_ends_friendship_and_prevents_requests(client, db_session):
    headers_a, user_a = register_and_login(client, username="carla", email="carla@example.com")
    headers_b, user_b = register_and_login(client, username="dani", email="dani@example.com")
    _befriend(client, headers_a, headers_b, "dani")
    capture_id = client.post("/captures", data=_capture_form(_lubina_species(db_session).id), headers=headers_a).json()["capture"]["id"]
    client.post(f"/captures/{capture_id}/comments", json={"text": "Feo"}, headers=headers_b)

    assert client.post(f"/users/{user_b['id']}/block", headers=headers_a).status_code == 204
    assert client.get("/friends", headers=headers_a).json() == []
    assert client.get(f"/captures/{capture_id}/comments", headers=headers_a).json() == []  # comentario oculto
    assert client.post("/friends/request", json={"to_username": "carla"}, headers=headers_b).status_code == 404
    assert [u["id"] for u in client.get("/users/me/blocked", headers=headers_a).json()] == [user_b["id"]]

    assert client.delete(f"/users/{user_b['id']}/block", headers=headers_a).status_code == 204
    assert client.post("/friends/request", json={"to_username": "carla"}, headers=headers_b).status_code == 201


def test_report_capture_and_admin_review(client, db_session):
    headers, _ = register_and_login(client)
    admin_headers, _ = register_and_login(client, username="admin", email="admin@example.com")
    capture_id = client.post("/captures", data=_capture_form(_lubina_species(db_session).id), headers=headers).json()["capture"]["id"]
    body = {"target_type": "CAPTURE", "target_id": capture_id, "reason": "FAKE_CAPTURE", "details": "Peso imposible"}
    first = client.post("/reports", json=body, headers=admin_headers)
    assert first.status_code == 201
    assert client.post("/reports", json=body, headers=admin_headers).json()["id"] == first.json()["id"]  # sin duplicados
    assert client.post("/reports", json={**body, "reason": "NOPE"}, headers=headers).status_code == 422
    assert client.get("/reports", headers=headers).status_code == 403
    assert len(client.get("/reports", headers=admin_headers).json()) == 1
    assert client.post(f"/reports/{first.json()['id']}/resolve", headers=admin_headers).status_code == 204
    assert client.get("/reports", headers=admin_headers).json() == []


# ------------------------------------------------------------ temporadas
def test_season_ranking_only_counts_this_quarter(client, db_session):
    from app.models.capture import Capture
    from app.services.season_service import season_for

    headers_a, user_a = register_and_login(client, username="eva", email="eva@example.com")
    headers_b, _ = register_and_login(client, username="fran", email="fran@example.com")
    species = _lubina_species(db_session)
    client.post("/captures", data=_capture_form(species.id), headers=headers_a)
    client.post("/captures", data=_capture_form(species.id), headers=headers_b)
    # La captura de B pasa a la temporada anterior: deja de contar en esta.
    season = season_for()
    db_session.query(Capture).filter(Capture.user_id != user_a["id"]).update(
        {Capture.captured_at: season.starts_at.astimezone(timezone.utc).replace(tzinfo=None) - timedelta(days=1)}
    )
    db_session.commit()

    page = client.get("/seasons/current", headers=headers_b).json()
    assert page["key"] == season.key and page["name"].startswith("Temporada de")
    assert [e["user"]["id"] for e in page["entries"]] == [user_a["id"]]
    assert page["me"] is None and len(page["rewards"]) == 4


def test_finished_season_awards_badges_once(client, db_session):
    from app.models.capture import Capture
    from app.models.season import SeasonAward
    from app.services import season_service

    headers_a, user_a = register_and_login(client, username="gala", email="gala@example.com")
    headers_b, user_b = register_and_login(client, username="hector", email="hector@example.com")
    species = _lubina_species(db_session)
    client.post("/captures", data=_capture_form(species.id), headers=headers_a)
    client.post("/captures", data=_capture_form(species.id), headers=headers_a)
    client.post("/captures", data=_capture_form(species.id), headers=headers_b)

    season = season_service.season_for()
    assert season_service.award_season(db_session, season) == 2
    assert season_service.award_season(db_session, season) == 0  # idempotente
    tiers = {a.user_id: a.tier for a in db_session.query(SeasonAward)}
    assert tiers == {user_a["id"]: "CHAMPION", user_b["id"]: "PODIUM"}
    profile = client.get("/users/me", headers=headers_a).json()
    assert profile["season_awards"][0]["tier_label"] == "Campeón de temporada"

    # La tarea periódica solo reparte la anterior, pasado el margen.
    next_season = season.next()
    season_service.award_finished_seasons(db_session, now=next_season.starts_at + timedelta(days=1))
    assert db_session.query(SeasonAward).count() == 2
    assert db_session.query(Capture).count() == 3


# ------------------------------------------------------------ previsión
def test_bite_forecast_scores_and_explains():
    from app.services.forecast_service import bite_forecast

    now = datetime(2026, 6, 10, 5, 30, tzinfo=timezone.utc)  # 07:30 en Madrid
    good = bite_forecast(
        {
            "pressure_hpa": 1015, "wind_speed_kmh": 6, "cloud_cover_pct": 50, "summary": "Poco nuboso",
            "tides": [{"type": "HIGH", "time": "2026-06-10T06:00:00Z"}],
            "moon": {"name": "Luna llena", "illumination": 0.98},
        },
        now=now,
    )
    assert good["score"] >= 75 and good["label"] == "Excelente" and good["partial"] is False
    assert any(f["label"] == "Marea" and f["points"] > 0 for f in good["factors"])

    stormy = bite_forecast({"pressure_hpa": 990, "wind_speed_kmh": 45, "summary": "Tormenta"}, now=now)
    assert stormy["score"] < 40 and stormy["label"] == "Mala"
    assert bite_forecast(None, now=now)["partial"] is True


def test_forecast_endpoint_never_fails_without_weather(client):
    headers, _ = register_and_login(client)
    body = client.get("/forecast", params={"latitude": 43.3, "longitude": -8.4}, headers=headers).json()
    assert 0 <= body["score"] <= 100 and body["partial"] is True


# ------------------------------------------------------------ captura y suelta
def test_catch_and_release_bonus_and_achievement(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)
    kept = client.post("/captures", data=_capture_form(species.id), headers=headers).json()
    released = client.post("/captures", data={**_capture_form(species.id, weight_kg=1), "released": "true"}, headers=headers).json()
    assert released["capture"]["released"] is True and kept["capture"]["released"] is False
    assert released["elo_earned"] == 2 + 5  # repetida (2) + bonus de suelta (5)
    assert "Captura y suelta" in released["new_achievements"]

    # Desmarcarlo recalcula el ELO sin el bonus.
    patched = client.patch(f"/captures/{released['capture']['id']}", json={"released": False}, headers=headers).json()
    assert patched["released"] is False and patched["elo_earned"] == 2


# ------------------------------------------------------------ mapa de calor
def test_heatmap_only_shows_cells_with_several_anglers(client, db_session):
    species = _lubina_species(db_session)
    users = [register_and_login(client, username=f"pesc{i}", email=f"pesc{i}@example.com")[0] for i in range(3)]
    for headers in users[:2]:  # dos personas en la misma zona
        client.post("/captures", data={**_capture_form(species.id), "latitude": "42.551", "longitude": "-8.871"}, headers=headers)
    # Una sola persona en otra zona: no debe aparecer (delataría su sitio).
    client.post("/captures", data={**_capture_form(species.id), "latitude": "37.10", "longitude": "-6.20"}, headers=users[2])

    body = client.get("/map/heatmap", params={"species_id": species.id}, headers=users[0]).json()
    assert body["species_name"] == "Lubina" and len(body["cells"]) == 1
    cell = body["cells"][0]
    assert cell["anglers"] == 2 and cell["captures"] == 2
    assert (cell["latitude"], cell["longitude"]) == (42.55, -8.85)  # centro de la celda, no la captura


# ------------------------------------------------------------ licencia
def test_license_reminders_are_sent_once_per_stage(client, db_session, monkeypatch):
    from app.models.user import User
    from app.services import license_service, notification_service

    sent = []
    monkeypatch.setattr(notification_service, "notify_users", lambda db, ids, title, body, data=None: sent.append(body))
    headers, user = register_and_login(client)
    today = date(2026, 3, 1)
    saved = client.put("/users/me/license", json={"expires_on": "2026-03-25", "region": "Galicia"}, headers=headers)
    assert saved.status_code == 200 and saved.json()["region"] == "Galicia"

    assert license_service.send_reminders(db_session, today=today) == 1  # faltan 24 días: aviso de 30
    assert license_service.send_reminders(db_session, today=today) == 0  # no se repite
    assert license_service.send_reminders(db_session, today=date(2026, 3, 20)) == 1  # aviso de 7 días
    assert license_service.send_reminders(db_session, today=date(2026, 3, 26)) == 1  # caducada
    assert "Galicia" in sent[0] and "caducado" in sent[-1]

    renewal = (date.today() + timedelta(days=365)).isoformat()
    renewed = client.put("/users/me/license", json={"expires_on": renewal}, headers=headers)
    assert 360 <= renewed.json()["days_left"] <= 366
    assert db_session.get(User, user["id"]).license_reminder_stage == 0
