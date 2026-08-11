"""GET /api/v1/admin/stats 검증 — 관리자 통계 화면(비밀번호 보호)."""

from __future__ import annotations

ADMIN_HEADER = {"X-Admin-Password": "test-admin-password"}


def _seed(client, event_type: str, game: str | None = None, difficulty: str | None = None) -> None:
    payload = {"event_type": event_type}
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
    _seed(client, "page_view")
    _seed(client, "page_view")
    _seed(client, "game_start", "chosung", "보통")
    _seed(client, "game_start", "chosung", "어려움")
    _seed(client, "game_start", "acid_rain", "쉬움")

    response = client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "total_page_views": 2,
        "total_game_starts": 3,
        "game_starts_by_game": {"chosung": 2, "acid_rain": 1},
    }


def test_stats_are_zero_when_no_events_recorded(client):
    response = client.get("/api/v1/admin/stats", headers=ADMIN_HEADER)
    assert response.status_code == 200
    assert response.json() == {
        "total_page_views": 0,
        "total_game_starts": 0,
        "game_starts_by_game": {"chosung": 0, "acid_rain": 0},
    }
