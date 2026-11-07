from tests.conftest import register_and_login


def test_friend_request_flow(client):
    headers_a, user_a = register_and_login(client, username="ana", email="ana@example.com")
    headers_b, user_b = register_and_login(client, username="bruno", email="bruno@example.com")

    response = client.post("/friends/request", json={"to_username": "bruno"}, headers=headers_a)
    assert response.status_code == 201
    request_id = response.json()["id"]

    pending = client.get("/friends/requests", headers=headers_b)
    assert len(pending.json()) == 1

    accept = client.post(f"/friends/accept/{request_id}", headers=headers_b)
    assert accept.status_code == 204

    friends_a = client.get("/friends", headers=headers_a)
    friends_b = client.get("/friends", headers=headers_b)
    assert len(friends_a.json()) == 1
    assert len(friends_b.json()) == 1


def test_cannot_send_duplicate_pending_request(client):
    register_and_login(client, username="carla", email="carla@example.com")
    headers_a, _ = register_and_login(client, username="dario", email="dario@example.com")

    client.post("/friends/request", json={"to_username": "carla"}, headers=headers_a)
    response = client.post("/friends/request", json={"to_username": "carla"}, headers=headers_a)
    assert response.status_code == 409


def test_reject_request_does_not_create_friendship(client):
    headers_a, _ = register_and_login(client, username="elena", email="elena@example.com")
    headers_b, _ = register_and_login(client, username="fran", email="fran@example.com")

    response = client.post("/friends/request", json={"to_username": "fran"}, headers=headers_a)
    request_id = response.json()["id"]
    client.post(f"/friends/reject/{request_id}", headers=headers_b)

    friends_a = client.get("/friends", headers=headers_a)
    assert len(friends_a.json()) == 0


def test_cannot_view_fishdex_of_non_friend(client):
    headers_a, _ = register_and_login(client, username="gema", email="gema@example.com")
    headers_b, user_b = register_and_login(client, username="hugo", email="hugo@example.com")

    response = client.get(f"/friends/{user_b['id']}/fishdex", headers=headers_a)
    assert response.status_code == 403


def test_can_view_own_fishdex_via_friend_endpoint(client):
    headers_a, user_a = register_and_login(client, username="irene", email="irene@example.com")
    response = client.get(f"/friends/{user_a['id']}/fishdex", headers=headers_a)
    assert response.status_code == 200


def test_comparison_between_friends(client):
    headers_a, user_a = register_and_login(client, username="julia", email="julia@example.com")
    headers_b, user_b = register_and_login(client, username="kevin", email="kevin@example.com")

    req = client.post("/friends/request", json={"to_username": "kevin"}, headers=headers_a)
    client.post(f"/friends/accept/{req.json()['id']}", headers=headers_b)

    response = client.get(f"/friends/{user_b['id']}/compare", headers=headers_a)
    assert response.status_code == 200
    body = response.json()
    assert body["me"]["user"]["id"] == user_a["id"]
    assert body["friend"]["user"]["id"] == user_b["id"]
