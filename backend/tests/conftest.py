import os

# El rate limiting de /auth (slowapi) usa un almacén en memoria compartido
# entre tests; se desactiva aquí para que la batería de tests no choque
# contra los límites de /auth/login y /auth/register.
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
# `TestClient(app)` ejecuta el `lifespan` de la app, que llama a `init_db()`
# sobre el motor GLOBAL (el de `DATABASE_URL`). Sin esto, cada ejecución de
# los tests creaba/migraba el `fishdex.db` real de desarrollo. Los tests usan
# su propia BD en memoria (fixture `db_session`); esta solo absorbe init_db.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
# Sin red ni procesos de fondo en los tests: la IA, el clima y el push se
# simulan donde hace falta con monkeypatch.
os.environ["OLLAMA_ENABLED"] = "false"
os.environ["WEATHER_ENABLED"] = "false"
os.environ["PUSH_ENABLED"] = "false"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["ADMIN_USERNAMES"] = "admin"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed.seed_data import (
    seed_achievements,
    seed_locations,
    seed_quotes,
    seed_regulations,
    seed_species,
)

TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture()
def db_session():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    species_by_dex = seed_species(session)
    seed_regulations(session, species_by_dex)
    seed_achievements(session)
    seed_locations(session)
    seed_quotes(session)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def register_and_login(client, username="pescador1", email="pescador1@example.com", password="contraseña123"):
    response = client.post(
        "/auth/register",
        json={"username": username, "email": email, "password": password, "display_name": "Pescador Uno"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, response.json()["user"]
