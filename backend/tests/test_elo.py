from datetime import datetime, timedelta, timezone

from app.core.game_config import Rarity, get_rank_for_elo
from app.models.fish_species import FishSpecies
from app.services.elo_service import calculate_capture_elo


def _species(**overrides) -> FishSpecies:
    defaults = dict(
        id=1, dex_number=1, name="Test", scientific_name="Testus testus", description="d", fun_fact="f",
        min_weight_kg=0.5, max_weight_kg=10.0, approx_min_length_cm=20, approx_max_length_cm=100,
        rarity=Rarity.RARE.value, habitat="h", water_type="SALT", region="r",
    )
    defaults.update(overrides)
    return FishSpecies(**defaults)


def test_new_species_grants_full_base_elo(db_session):
    species = _species()
    breakdown = calculate_capture_elo(
        db_session, user_id=1, species=species, weight_kg=1.0, length_cm=30.0,
        is_new_species=True, is_personal_record=True, captured_at=datetime.now(timezone.utc),
    )
    assert breakdown.total == 35  # RARE base ELO


def test_repeated_species_grants_reduced_elo(db_session):
    species = _species()
    breakdown = calculate_capture_elo(
        db_session, user_id=1, species=species, weight_kg=1.0, length_cm=30.0,
        is_new_species=False, is_personal_record=False, captured_at=datetime.now(timezone.utc),
    )
    assert breakdown.total == 4  # round(35 * 0.10)


def test_personal_record_adds_bonus(db_session):
    species = _species()
    breakdown = calculate_capture_elo(
        db_session, user_id=1, species=species, weight_kg=1.0, length_cm=30.0,
        is_new_species=False, is_personal_record=True, captured_at=datetime.now(timezone.utc),
    )
    assert breakdown.record_bonus == 25
    assert breakdown.total == 4 + 25


def test_exceptional_size_adds_bonus(db_session):
    species = _species(max_weight_kg=10.0, approx_max_length_cm=100)
    breakdown = calculate_capture_elo(
        db_session, user_id=1, species=species, weight_kg=9.5, length_cm=30.0,
        is_new_species=False, is_personal_record=False, captured_at=datetime.now(timezone.utc),
    )
    assert breakdown.size_bonus == 15


def test_daily_farming_limit_caps_elo_to_zero(db_session, client):
    from tests.conftest import register_and_login

    headers, _ = register_and_login(client, username="farmer", email="farmer@example.com")
    from app.models.fish_species import FishSpecies as FS

    species = db_session.query(FS).filter(FS.name == "Lubina").first()
    now = datetime.now(timezone.utc)

    for i in range(4):
        form = {
            "fish_species_id": str(species.id),
            "weight_kg": "1.0",
            "length_cm": "30.0",
            "captured_at": (now - timedelta(minutes=i)).isoformat(),
        }
        response = client.post("/captures", data=form, headers=headers)
        assert response.status_code == 201

    me = client.get("/users/me", headers=headers)
    elo = me.json()["user"]["elo"]
    # 1ª: especie nueva (20) + 2ª,3ª: repetidas (2 cada una) + 4ª: bloqueada por límite diario (0)
    assert elo == 20 + 2 + 2 + 0


def test_rank_thresholds():
    assert get_rank_for_elo(0)["name"] == "Alevín"
    assert get_rank_for_elo(500)["name"] == "Pescador"
    assert get_rank_for_elo(3000)["name"] == "Leyenda"
    assert get_rank_for_elo(999999)["name"] == "Leyenda"
