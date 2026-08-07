"""GET /api/v1/scores/recent 검증 — 06_API_DB매핑: nickname이 아닌 player_key 기준."""

from __future__ import annotations

import uuid


def _submit(client, player_key, **overrides):
    payload = {
        "nickname": "선수",
        "game": "chosung",
        "difficulty": "쉬움",
        "score": 100,
        "correct_count": 5,
        "no_hint_correct_count": 3,
        "max_combo": 2,
        "player_key": player_key,
        **overrides,
    }
    response = client.post("/api/v1/scores", json=payload)
    assert response.status_code == 201
    return response


def test_recent_records_filtered_by_player_key_not_nickname(client):
    # 같은 닉네임이라도 player_key가 다르면(다른 브라우저) 서로의 기록이 안 보여야 한다.
    me = str(uuid.uuid4())
    someone_else = str(uuid.uuid4())
    _submit(client, me, score=10)
    _submit(client, someone_else, nickname="선수", score=130)

    response = client.get(
        "/api/v1/scores/recent",
        params={"player_key": me, "game": "chosung", "difficulty": "쉬움"},
    )
    assert response.status_code == 200
    records = response.json()["records"]
    assert len(records) == 1
    assert records[0]["score"] == 10


def test_recent_records_ordered_by_played_at_desc(client):
    player_key = str(uuid.uuid4())
    for score in [10, 20, 30]:
        _submit(client, player_key, score=score)

    response = client.get(
        "/api/v1/scores/recent",
        params={"player_key": player_key, "game": "chosung", "difficulty": "쉬움"},
    )
    scores = [row["score"] for row in response.json()["records"]]
    assert scores == [30, 20, 10]


def test_recent_records_respects_limit(client):
    player_key = str(uuid.uuid4())
    for score in range(5):
        _submit(client, player_key, score=score)

    response = client.get(
        "/api/v1/scores/recent",
        params={"player_key": player_key, "game": "chosung", "difficulty": "쉬움", "limit": 2},
    )
    assert len(response.json()["records"]) == 2


def test_recent_records_isolated_by_game_and_difficulty(client):
    player_key = str(uuid.uuid4())
    _submit(client, player_key, difficulty="쉬움", score=10)
    _submit(client, player_key, difficulty="보통", score=20)

    response = client.get(
        "/api/v1/scores/recent",
        params={"player_key": player_key, "game": "chosung", "difficulty": "쉬움"},
    )
    assert [row["score"] for row in response.json()["records"]] == [10]


def test_chosung_recent_records_omit_stage_reached(client):
    player_key = str(uuid.uuid4())
    _submit(client, player_key)

    response = client.get(
        "/api/v1/scores/recent",
        params={"player_key": player_key, "game": "chosung", "difficulty": "쉬움"},
    )
    assert "stage_reached" not in response.json()["records"][0]


def test_empty_recent_records(client):
    response = client.get(
        "/api/v1/scores/recent",
        params={"player_key": str(uuid.uuid4()), "game": "chosung", "difficulty": "쉬움"},
    )
    assert response.status_code == 200
    assert response.json()["records"] == []
