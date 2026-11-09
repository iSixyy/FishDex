"""Regresiones de la auditoría: token de cuenta borrada, previsión de picada,
avisos de licencia y contador de comentarios con bloqueos."""
from datetime import date, datetime, timedelta, timezone

from app.core.security import create_access_token
from app.models.user import User
from app.services import forecast_service, license_service, notification_service, weather_service
from tests.conftest import register_and_login


def test_token_of_deleted_account_does_not_open_the_next_account(client):
    old_headers, _ = register_and_login(client, "victima", "victima@example.com")
    response = client.request("DELETE", "/users/me", json={"password": "contraseña123"}, headers=old_headers)
    assert response.status_code == 204, response.text

    register_and_login(client, "nuevo", "nuevo@example.com")
    assert client.get("/users/me", headers=old_headers).status_code == 401


def test_token_issued_before_account_creation_is_rejected(client, db_session):
    _, user = register_and_login(client)
    db_user = db_session.get(User, user["id"])
    # Simula el id heredado: un token firmado para ese id antes de crear la cuenta.
    db_user.created_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    db_session.commit()
    token = create_access_token(subject=user["id"])
    assert client.get("/users/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_weather_requests_sea_level_pressure(monkeypatch):
    calls = []

    class FakeResponse:
        status_code = 200

        def __init__(self, url):
            self.url = url

        def json(self):
            if "marine" in self.url:
                return {"current": {}, "hourly": {}}
            return {"current": {"pressure_msl": 1016.0, "surface_pressure": 940.0, "wind_speed_10m": 5}}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, params):
            calls.append(params)
            return FakeResponse(url)

    monkeypatch.setattr(weather_service.httpx, "Client", FakeClient)
    monkeypatch.setattr(weather_service, "_cache", {})
    settings = weather_service.get_settings()
    monkeypatch.setattr(settings, "weather_enabled", True)
    monkeypatch.setattr(settings, "weather_demo_mode", False)

    conditions = weather_service.get_conditions(40.42, -3.70)  # Madrid, ~650 m
    assert conditions["pressure_hpa"] == 1016.0
    assert "pressure_msl" in calls[0]["current"]
    forecast = forecast_service.bite_forecast(conditions)
    assert not any(f["label"] == "Presión" and f["points"] < 0 for f in forecast["factors"])


def test_forecast_is_partial_when_weather_values_are_missing():
    empty_weather = {"pressure_hpa": None, "wind_speed_kmh": None, "tides": [], "summary": None}
    assert forecast_service.bite_forecast(empty_weather)["partial"] is True
    assert forecast_service.bite_forecast({"pressure_hpa": 1015, "wind_speed_kmh": 5})["partial"] is False


def test_license_reminder_texts(client, db_session, monkeypatch):
    sent = []
    monkeypatch.setattr(notification_service, "notify_users", lambda db, ids, title, body, data=None: sent.append(body))
    _, user = register_and_login(client)
    db_user = db_session.get(User, user["id"])
    today = date(2027, 3, 1)

    db_user.license_expires_on = today
    db_user.license_reminder_stage = 2
    db_session.commit()
    license_service.send_reminders(db_session, today=today)
    assert "caduca hoy" in sent[-1]

    db_user.license_expires_on = today + timedelta(days=1)
    db_user.license_reminder_stage = 1
    db_session.commit()
    license_service.send_reminders(db_session, today=today)
    assert "1 día." in sent[-1]


def test_feed_comment_count_ignores_blocked_users(client):
    owner, _ = register_and_login(client, "duena", "duena@example.com")
    friend, friend_user = register_and_login(client, "amigo", "amigo@example.com")
    client.post("/friends/request", json={"to_username": "amigo"}, headers=owner)
    request_id = client.get("/friends/requests", headers=friend).json()[0]["id"]
    assert client.post(f"/friends/accept/{request_id}", headers=friend).status_code == 204

    capture = client.post(
        "/captures",
        data={"fish_species_id": 1, "weight_kg": 1.0, "length_cm": 30,
              "captured_at": datetime.now(timezone.utc).isoformat()},
        headers=owner,
    )
    assert capture.status_code == 201, capture.text
    capture_id = capture.json()["capture"]["id"]
    assert client.post(f"/captures/{capture_id}/comments", json={"text": "¡Bonita!"}, headers=friend).status_code == 201

    client.post(f"/users/{friend_user['id']}/block", headers=owner)
    entry = next(e for e in client.get("/feed", headers=owner).json() if e["id"] == capture_id)
    assert entry["comment_count"] == 0
