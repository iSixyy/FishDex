from tests.conftest import register_and_login


def test_register_creates_user_with_zero_elo(client):
    headers, user = register_and_login(client)
    assert user["elo"] == 0
    assert user["rank"]["name"] == "Alevín"


def test_register_duplicate_username_fails(client):
    register_and_login(client, username="duplicado", email="a@example.com")
    response = client.post(
        "/auth/register",
        json={
            "username": "duplicado",
            "email": "b@example.com",
            "password": "contraseña123",
            "display_name": "Otro",
        },
    )
    assert response.status_code == 409


def test_login_with_correct_credentials(client):
    client.post(
        "/auth/register",
        json={
            "username": "loginuser",
            "email": "login@example.com",
            "password": "contraseña123",
            "display_name": "Login User",
        },
    )
    response = client.post("/auth/login", json={"email": "login@example.com", "password": "contraseña123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_with_wrong_password_fails(client):
    client.post(
        "/auth/register",
        json={
            "username": "wrongpass",
            "email": "wrong@example.com",
            "password": "contraseña123",
            "display_name": "Wrong Pass",
        },
    )
    response = client.post("/auth/login", json={"email": "wrong@example.com", "password": "incorrecta"})
    assert response.status_code == 401


def test_protected_route_requires_token(client):
    response = client.get("/users/me")
    assert response.status_code == 401


def test_password_is_not_stored_in_plain_text(client, db_session):
    register_and_login(client, username="hashcheck", email="hash@example.com", password="supersecreta1")
    from app.models.user import User

    user = db_session.query(User).filter(User.username == "hashcheck").first()
    assert user.password_hash != "supersecreta1"
    assert user.password_hash.startswith("$2b$")
