from datetime import datetime, timedelta, timezone

from app.core.game_config import MAX_CAPTURED_AT_AGE_DAYS
from tests.conftest import register_and_login


def test_species_catalog_exposes_all_names_even_if_not_discovered(client):
    headers, _ = register_and_login(client)
    response = client.get("/fish/catalog", headers=headers)
    assert response.status_code == 200
    names = [entry["name"] for entry in response.json()]
    assert "Lubina" in names
    assert len(response.json()) == 17  # especies del seed


def test_register_rejects_short_password(client):
    response = client.post(
        "/auth/register",
        json={"username": "shortpass", "email": "short@example.com", "password": "123", "display_name": "X"},
    )
    assert response.status_code == 422


def test_register_rejects_invalid_username(client):
    response = client.post(
        "/auth/register",
        json={
            "username": "usuario con espacios",
            "email": "spaces@example.com",
            "password": "contraseña123",
            "display_name": "X",
        },
    )
    assert response.status_code == 422


def test_capture_requires_authentication(client):
    response = client.post(
        "/captures",
        data={
            "fish_species_id": "1",
            "weight_kg": "1.0",
            "length_cm": "20.0",
            "captured_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert response.status_code == 401


def test_capture_rejects_unknown_species(client):
    headers, _ = register_and_login(client)
    response = client.post(
        "/captures",
        data={
            "fish_species_id": "99999",
            "weight_kg": "1.0",
            "length_cm": "20.0",
            "captured_at": datetime.now(timezone.utc).isoformat(),
        },
        headers=headers,
    )
    assert response.status_code == 404


def _capture_form(captured_at: datetime) -> dict:
    return {
        "fish_species_id": "1",
        "weight_kg": "1.0",
        "length_cm": "20.0",
        "captured_at": captured_at.isoformat(),
    }


def test_capture_rejects_future_date_with_readable_422(client):
    """Regresión: `exc.errors()` incluye el ValueError original y el datetime de
    entrada en crudo. Serializarlos tal cual convertía este 422 en un 500."""
    headers, _ = register_and_login(client)
    future = datetime.now(timezone.utc) + timedelta(days=2)
    response = client.post("/captures", data=_capture_form(future), headers=headers)

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "futura" in detail[0]["msg"]


def test_capture_rejects_too_old_date_with_readable_422(client):
    headers, _ = register_and_login(client)
    too_old = datetime.now(timezone.utc) - timedelta(days=MAX_CAPTURED_AT_AGE_DAYS + 1)
    response = client.post("/captures", data=_capture_form(too_old), headers=headers)

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "antigüedad" in detail[0]["msg"]


def test_capture_accepts_date_inside_offline_queue_window(client):
    """Una captura encolada sin conexión durante días debe seguir aceptándose:
    la ventana permitida es más holgada que la caducidad del token."""
    headers, _ = register_and_login(client)
    recent = datetime.now(timezone.utc) - timedelta(days=MAX_CAPTURED_AT_AGE_DAYS - 1)
    response = client.post("/captures", data=_capture_form(recent), headers=headers)

    assert response.status_code == 201


def test_capture_accepts_naive_datetime_without_timezone(client):
    """Un `captured_at` sin zona horaria se interpreta como UTC en vez de
    reventar al comparar datetimes naive y aware."""
    headers, _ = register_and_login(client)
    naive = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
    response = client.post("/captures", data=_capture_form(naive), headers=headers)

    assert response.status_code == 201


def test_capture_with_offset_is_normalized_to_utc(client):
    """Regresión: `DateTime(timezone=True)` es un no-op en SQLite, así que
    guardar un datetime aware con offset (p. ej. +02:00, la hora normal en
    España) sin normalizar antes desplazaba el instante 1-2 horas al perder
    el offset. El servidor debe normalizar a UTC antes de persistir, de forma
    que la captura devuelta represente el MISMO instante que se envió."""
    headers, _ = register_and_login(client)
    moment_utc = datetime.now(timezone.utc) - timedelta(minutes=10)
    moment_with_offset = moment_utc.astimezone(timezone(timedelta(hours=2)))

    response = client.post("/captures", data=_capture_form(moment_with_offset), headers=headers)
    assert response.status_code == 201, response.text

    returned = datetime.fromisoformat(response.json()["capture"]["captured_at"])
    # SQLite no conserva el tzinfo al releer un `DateTime(timezone=True)` (es
    # justo la limitación de la que trata esta regresión): el datetime vuelve
    # "naive". Lo relevante es que sus dígitos sean ya los de UTC, así que se
    # interpretan como tales para comparar el instante real.
    if returned.tzinfo is None:
        returned = returned.replace(tzinfo=timezone.utc)
    assert returned == moment_utc  # mismo instante, sea cual sea el offset original de entrada


def test_capture_response_datetime_carries_explicit_utc_offset(client):
    """Regresión: SQLite devuelve los datetimes sin `tzinfo` aunque se guardaron
    en UTC. Si la API los serializa así, `new Date(...)` en el móvil los toma
    como hora LOCAL y la app muestra la hora desplazada 1-2 h en España."""
    headers, _ = register_and_login(client)
    moment = datetime.now(timezone.utc) - timedelta(minutes=10)

    response = client.post("/captures", data=_capture_form(moment), headers=headers)
    assert response.status_code == 201, response.text

    raw = response.json()["capture"]["captured_at"]
    assert raw.endswith("+00:00"), f"sin marcador de zona: {raw}"
    assert datetime.fromisoformat(raw).utcoffset() == timedelta(0)
