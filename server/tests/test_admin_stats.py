"""GET /api/v1/admin/stats 검증 — 관리자 통계 화면(비밀번호 보호)."""

from __future__ import annotations

ADMIN_HEADER = {"X-Admin-Password": "test-admin-password"}


def _seed(
    client,
    event_type: str,
    game: str | None = None,
    difficulty: str | None = None,
    player_key: str | None = None,
) -> None:
    payload = {"event_type": event_type}
    if player_key is not None:
        payload["player_key"] = player_key
    if game is not None:
        payload["game"] = game
        payload["difficulty"] = difficulty
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201


def test_stats_requires_correct_password(client):
    response = client.get("/api/v1/admin/stats")
    assert response.status_code == 401

    wrong = client.get("/api/v1/admin/stats", headers={"X-Admin-Password": "wrong"})
    assert wrong.status_code == 401


def test_stats_counts_page_views_and_game_starts_by_game(client):
    first = "11111111-1111-4111-8111-111111111111"
    second = "22222222-2222-4222-8222-222222222222"
    _seed(client, "page_view", player_key=first)
    _seed(client, "page_view", player_key=second)
    _seed(client, "game_start", "chosung", "보통", first)
    _seed(client, "game_start", "chosung", "어려움", first)
    _seed(client, "game_start", "acid_rain", "쉬움", second)

    response = client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    assert response.status_code == 200
    body = response.json()
    assert body["total_page_views"] == 2
    assert body["total_game_starts"] == 3
    assert body["unique_visitors"] == 2
    assert body["game_starts_by_game"] == {"chosung": 2, "acid_rain": 1}
    assert body["usage_rate_percent"] == 100.0
    assert body["average_game_starts_per_player"] == 1.5


def test_stats_are_zero_when_no_events_recorded(client):
    response = client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    assert response.status_code == 200
    assert response.json() == {
        "total_page_views": 0,
        "total_game_starts": 0,
        "unique_visitors": 0,
        "game_starts_by_game": {"chosung": 0, "acid_rain": 0},
        "unique_players": 0,
        "usage_rate_percent": None,  # 방문자가 없으면 나눌 수 없어 null
        "average_game_starts_per_player": None,
    }


def test_stats_count_unique_players_across_repeated_starts(client):
    same_key = "11111111-1111-4111-8111-111111111111"
    other_key = "22222222-2222-4222-8222-222222222222"
    client.post(
        "/api/v1/events",
        json={"event_type": "game_start", "player_key": same_key, "game": "chosung", "difficulty": "보통"},
    )
    client.post(
        "/api/v1/events",
        json={"event_type": "game_start", "player_key": same_key, "game": "chosung", "difficulty": "보통"},
    )
    client.post(
        "/api/v1/events",
        json={"event_type": "game_start", "player_key": other_key, "game": "acid_rain", "difficulty": "쉬움"},
    )

    response = client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    body = response.json()
    assert body["total_game_starts"] == 3
    assert body["unique_players"] == 2  # 같은 player_key로 2번 시작해도 한 명


def test_stats_usage_rate_reflects_visits_vs_game_starts(client):
    visitor_keys = [f"00000000-0000-4000-8000-{i:012d}" for i in range(4)]
    for player_key in visitor_keys:
        client.post("/api/v1/events", json={"event_type": "page_view", "player_key": player_key})
    for _ in range(2):
        client.post(
            "/api/v1/events",
            json={"event_type": "game_start", "player_key": visitor_keys[0], "game": "chosung", "difficulty": "보통"},
        )

    response = client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    body = response.json()
    assert body["total_page_views"] == 4
    assert body["total_game_starts"] == 2
    assert body["unique_visitors"] == 4
    assert body["unique_players"] == 1
    assert body["usage_rate_percent"] == 25.0
    assert body["average_game_starts_per_player"] == 2.0
