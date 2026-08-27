"""GET /api/v1/scores/recent의 서명된 익명 플레이어 접근 검증."""
from __future__ import annotations

import uuid

from app.security import issue_player_token


def _headers(player_key: str) -> dict[str, str]:
    return {"X-Player-Token": issue_player_token(uuid.UUID(player_key))}


def _submit(client, player_key, **overrides):
    payload = {
        "nickname": "선수", "game": "chosung", "difficulty": "쉬움", "score": 100,
        "correct_count": 8, "no_hint_correct_count": 3, "max_combo": 2,
        "player_key": player_key, **overrides,
    }
    response = client.post("/api/v1/scores", json=payload, headers=_headers(player_key))
    assert response.status_code == 201
    return response


def test_recent_records_filtered_by_signed_player_not_query_parameter(client):
    me, someone_else = str(uuid.uuid4()), str(uuid.uuid4())
    _submit(client, me, score=10)
    _submit(client, someone_else, score=130, correct_count=10)
    response = client.get(
        "/api/v1/scores/recent",
        params={"player_key": someone_else, "game": "chosung", "difficulty": "쉬움"},
        headers=_headers(me),
    )
    assert [row["score"] for row in response.json()["records"]] == [10]


def test_recent_records_ordered_by_played_at_desc(client):
    player_key = str(uuid.uuid4())
    for score in [10, 20, 30]: _submit(client, player_key, score=score)
    response = client.get("/api/v1/scores/recent", params={"game": "chosung", "difficulty": "쉬움"}, headers=_headers(player_key))
    assert [row["score"] for row in response.json()["records"]] == [30, 20, 10]


def test_recent_records_respects_limit(client):
    player_key = str(uuid.uuid4())
    for score in range(5): _submit(client, player_key, score=score)
    response = client.get("/api/v1/scores/recent", params={"game": "chosung", "difficulty": "쉬움", "limit": 2}, headers=_headers(player_key))
    assert len(response.json()["records"]) == 2


def test_recent_records_isolated_by_difficulty(client):
    player_key = str(uuid.uuid4())
    _submit(client, player_key, difficulty="쉬움", score=10)
    _submit(client, player_key, difficulty="보통", score=20)
    response = client.get("/api/v1/scores/recent", params={"game": "chosung", "difficulty": "쉬움"}, headers=_headers(player_key))
    assert [row["score"] for row in response.json()["records"]] == [10]


def test_chosung_recent_records_omit_stage_reached(client):
    player_key = str(uuid.uuid4())
    _submit(client, player_key)
    response = client.get("/api/v1/scores/recent", params={"game": "chosung", "difficulty": "쉬움"}, headers=_headers(player_key))
    assert "stage_reached" not in response.json()["records"][0]


def test_recent_records_requires_valid_player_token(client):
    params = {"game": "chosung", "difficulty": "쉬움"}
    assert client.get(
        "/api/v1/scores/recent", params=params, headers={"X-Player-Token": ""}
    ).status_code == 401
    assert client.get("/api/v1/scores/recent", params=params, headers={"X-Player-Token": "forged"}).status_code == 401

def test_recent_records_are_rate_limited(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "recent_rate_limit_max_requests", 1)
    player_key = str(uuid.uuid4())
    params = {"game": "chosung", "difficulty": "쉬움"}
    assert client.get(
        "/api/v1/scores/recent", params=params, headers=_headers(player_key)
    ).status_code == 200
    assert client.get(
        "/api/v1/scores/recent", params=params, headers=_headers(player_key)
    ).status_code == 429