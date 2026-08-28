"""GET /api/v1/admin/stats 검증 — 관리자 통계 화면(비밀번호 보호)."""

from __future__ import annotations

import uuid

from app.security import issue_player_token

ADMIN_HEADER = {"X-Admin-Password": "test-admin-password"}


def _player_headers(player_key: str) -> dict[str, str]:
    return {"X-Player-Token": issue_player_token(uuid.UUID(player_key))}


def _seed(
    authorized_client,
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
    headers = _player_headers(player_key) if player_key is not None else None
    response = authorized_client.post("/api/v1/events", json=payload, headers=headers)
    assert response.status_code == 201


def test_stats_requires_correct_password(authorized_client):
    response = authorized_client.get("/api/v1/admin/stats")
    assert response.status_code == 401

    wrong = authorized_client.get("/api/v1/admin/stats", headers={"X-Admin-Password": "wrong"})
    assert wrong.status_code == 401


def test_stats_counts_page_views_and_game_starts_by_game(authorized_client):
    first = "11111111-1111-4111-8111-111111111111"
    second = "22222222-2222-4222-8222-222222222222"
    _seed(authorized_client, "page_view", player_key=first)
    _seed(authorized_client, "page_view", player_key=second)
    _seed(authorized_client, "game_start", "chosung", "보통", first)
    _seed(authorized_client, "game_start", "chosung", "어려움", first)
    _seed(authorized_client, "game_start", "acid_rain", "쉬움", second)

    response = authorized_client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    assert response.status_code == 200
    body = response.json()
    assert body["total_page_views"] == 2
    assert body["total_game_starts"] == 3
    assert body["unique_visitors"] == 2
    assert body["game_starts_by_game"] == {"chosung": 2, "acid_rain": 1}
    # 2026-08-18부터 이용률 = 게임 시작 횟수 ÷ 방문 횟수(둘 다 총계) — 한 번의 방문에서 게임을 여러 번 시작해서(3회) 방문 횟수(2회)를 넘어 150%가 된다.
    assert body["usage_rate_percent"] == 150.0
    assert body["average_game_starts_per_player"] == 1.5


def test_stats_are_zero_when_no_events_recorded(authorized_client):
    response = authorized_client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
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


def test_stats_count_unique_players_across_repeated_starts(authorized_client):
    same_key = "11111111-1111-4111-8111-111111111111"
    other_key = "22222222-2222-4222-8222-222222222222"
    authorized_client.post(
        "/api/v1/events",
        json={"event_type": "game_start", "player_key": same_key, "game": "chosung", "difficulty": "보통"},
        headers=_player_headers(same_key),
    )
    authorized_client.post(
        "/api/v1/events",
        json={"event_type": "game_start", "player_key": same_key, "game": "chosung", "difficulty": "보통"},
        headers=_player_headers(same_key),
    )
    authorized_client.post(
        "/api/v1/events",
        json={"event_type": "game_start", "player_key": other_key, "game": "acid_rain", "difficulty": "쉬움"},
        headers=_player_headers(other_key),
    )

    response = authorized_client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    body = response.json()
    assert body["total_game_starts"] == 3
    assert body["unique_players"] == 2  # 같은 player_key로 2번 시작해도 한 명


def test_stats_usage_rate_reflects_visits_vs_game_starts(authorized_client):
    visitor_keys = [f"00000000-0000-4000-8000-{i:012d}" for i in range(4)]
    for player_key in visitor_keys:
        authorized_client.post(
            "/api/v1/events",
            json={"event_type": "page_view", "player_key": player_key},
            headers=_player_headers(player_key),
        )
    for _ in range(2):
        authorized_client.post(
            "/api/v1/events",
            json={"event_type": "game_start", "player_key": visitor_keys[0], "game": "chosung", "difficulty": "보통"},
            headers=_player_headers(visitor_keys[0]),
        )

    response = authorized_client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    body = response.json()
    assert body["total_page_views"] == 4
    assert body["total_game_starts"] == 2
    assert body["unique_visitors"] == 4
    assert body["unique_players"] == 1
    # 방문 4회 중 게임 시작 2회 → 2/4*100 = 50.0 (총계 대 총계, 2026-08-18)
    assert body["usage_rate_percent"] == 50.0
    assert body["average_game_starts_per_player"] == 2.0


def test_admin_failed_attempts_are_rate_limited(authorized_client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "admin_rate_limit_max_requests", 2)
    headers = {"X-Admin-Password": "wrong"}
    assert authorized_client.get("/api/v1/admin/stats", headers=headers).status_code == 401
    assert authorized_client.get("/api/v1/admin/stats", headers=headers).status_code == 401
    assert authorized_client.get("/api/v1/admin/stats", headers=headers).status_code == 429
