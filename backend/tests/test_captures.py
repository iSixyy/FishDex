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


def test_first_capture_unlocks_species_and_grants_elo(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)

    response = client.post("/captures", data=_capture_form(species.id), headers=headers)
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["is_new_species"] is True
    assert body["elo_earned"] == 20  # UNCOMMON base ELO configurado
    assert body["capture"]["is_new_species"] is True
    assert "FIRST_CATCH" not in body["new_achievements"]  # se compara por nombre, no código
    assert len(body["new_achievements"]) >= 1  # "Primera captura" desbloqueado


def test_repeated_capture_grants_reduced_elo(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)

    client.post("/captures", data=_capture_form(species.id), headers=headers)
    response = client.post("/captures", data=_capture_form(species.id, weight_kg=1.0), headers=headers)
    body = response.json()

    assert body["is_new_species"] is False
    assert body["elo_earned"] < 20  # ELO de captura repetida, no el de especie nueva


def test_client_cannot_inject_elo(client, db_session):
    """El ELO enviado por el cliente (si lo hubiera) se ignora: el servidor
    siempre recalcula. Simulamos un intento enviando un campo extra."""
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)

    form = _capture_form(species.id)
    form["elo"] = "999999"  # campo no soportado por el schema, debe ignorarse
    response = client.post("/captures", data=form, headers=headers)
    assert response.status_code == 201
    assert response.json()["elo_earned"] != 999999

    me = client.get("/users/me", headers=headers)
    assert me.json()["user"]["elo"] < 999999


def test_new_personal_record_is_detected(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)

    client.post("/captures", data=_capture_form(species.id, weight_kg=2.0), headers=headers)
    response = client.post("/captures", data=_capture_form(species.id, weight_kg=3.5), headers=headers)
    body = response.json()

    assert body["record"]["is_new_record"] is True
    assert body["record"]["previous_weight_kg"] == 2.0


def test_invalid_weight_is_rejected(client, db_session):
    headers, _ = register_and_login(client)
    species = _lubina_species(db_session)

    form = _capture_form(species.id, weight_kg=-5)
    response = client.post("/captures", data=form, headers=headers)
    assert response.status_code == 422
