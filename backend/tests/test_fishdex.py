from datetime import datetime, timezone

from tests.conftest import register_and_login


def test_undiscovered_species_are_shown_locked(client):
    headers, _ = register_and_login(client)
    response = client.get("/fish", headers=headers)
    body = response.json()

    assert body["discovered"] == 0
    assert body["total"] > 0
    for entry in body["species"]:
        assert entry["unlocked"] is False
        assert entry["name"] is None
        assert entry["rarity"] is None


def test_capturing_unlocks_species_in_dex(client, db_session):
    headers, _ = register_and_login(client)
    from app.models.fish_species import FishSpecies

    species = db_session.query(FishSpecies).filter(FishSpecies.name == "Lubina").first()

    client.post(
        "/captures",
        data={
            "fish_species_id": str(species.id),
            "weight_kg": "2.0",
            "length_cm": "40.0",
            "captured_at": datetime.now(timezone.utc).isoformat(),
        },
        headers=headers,
    )

    response = client.get("/fish", headers=headers)
    body = response.json()
    assert body["discovered"] == 1
    lubina_entry = next(e for e in body["species"] if e["dex_number"] == species.dex_number)
    assert lubina_entry["unlocked"] is True
    assert lubina_entry["name"] == "Lubina"


def test_species_without_regulation_shows_no_legal_data(client, db_session):
    from app.models.fish_species import FishSpecies

    headers, _ = register_and_login(client)
    species = db_session.query(FishSpecies).filter(FishSpecies.name == "Dorada").first()
    response = client.get(f"/fish/{species.id}", headers=headers)
    body = response.json()
    assert body["regulations"] == []  # sin datos inventados: lista vacía


def test_species_with_known_regulation_exposes_source(client, db_session):
    from app.models.fish_species import FishSpecies

    headers, _ = register_and_login(client)
    species = db_session.query(FishSpecies).filter(FishSpecies.name == "Lubina").first()
    response = client.get(f"/fish/{species.id}", headers=headers)
    body = response.json()
    assert len(body["regulations"]) == 1
    assert body["regulations"][0]["legal_min_length_cm"] == 42.0
    assert body["regulations"][0]["source"] is not None
