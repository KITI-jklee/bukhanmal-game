"""C-2 GET /api/v1/rankings 검증."""

from __future__ import annotations


def _submit(client, **overrides):
    payload = {
        "nickname": "선수",
        "game": "acid_rain",
        "difficulty": "쉬움",
        "score": 100,
        "stage_reached": 1,
        "max_combo": 3,
        "time_stop_uses": 0,
        "time_stop_clears": 0,
        "play_time_seconds": 30,
        **overrides,
    }
    response = client.post("/api/v1/scores", json=payload)
    assert response.status_code == 201
    return response


def test_empty_leaderboard(client):
    response = client.get("/api/v1/rankings", params={"game": "acid_rain", "difficulty": "쉬움"})
    assert response.status_code == 200
    body = response.json()
    assert body == {"game": "acid_rain", "difficulty": "쉬움", "top5": []}


def test_top5_sorted_by_score_descending(client):
    for score in [300, 100, 500, 200, 400]:
        _submit(client, nickname="선수", score=score)

    response = client.get("/api/v1/rankings", params={"game": "acid_rain", "difficulty": "쉬움"})
    scores = [row["score"] for row in response.json()["top5"]]
    assert scores == [500, 400, 300, 200, 100]


def test_only_top5_returned_even_with_more_records(client):
    for i in range(7):
        _submit(client, nickname=f"선수{i}", score=i * 10)

    response = client.get("/api/v1/rankings", params={"game": "acid_rain", "difficulty": "쉬움"})
    body = response.json()
    assert len(body["top5"]) == 5
    assert [row["rank"] for row in body["top5"]] == [1, 2, 3, 4, 5]


def test_tie_breaks_by_earliest_played_at(client):
    # 동점이면 먼저 달성한 기록이 위(FR-RK-06)
    first = _submit(client, nickname="먼저", score=100)
    second = _submit(client, nickname="나중", score=100)
    assert first.json()["rank"] == 1
    assert second.json()["rank"] == 2

    response = client.get("/api/v1/rankings", params={"game": "acid_rain", "difficulty": "쉬움"})
    nicknames = [row["nickname"] for row in response.json()["top5"]]
    assert nicknames == ["먼저", "나중"]


def test_acid_rain_entries_include_stage_reached(client):
    _submit(client, stage_reached=3)
    response = client.get("/api/v1/rankings", params={"game": "acid_rain", "difficulty": "쉬움"})
    assert response.json()["top5"][0]["stage_reached"] == 3


def test_chosung_entries_omit_stage_reached(client):
    client.post(
        "/api/v1/scores",
        json={
            "nickname": "초성러",
            "game": "chosung",
            "difficulty": "쉬움",
            "score": 100,
            "correct_count": 7,
            "no_hint_correct_count": 5,
            "max_combo": 4,
        },
    )
    response = client.get("/api/v1/rankings", params={"game": "chosung", "difficulty": "쉬움"})
    entry = response.json()["top5"][0]
    assert "stage_reached" not in entry


def test_leaderboards_are_isolated_by_game_and_difficulty(client):
    _submit(client, difficulty="쉬움", score=100)
    _submit(client, difficulty="보통", score=999)

    easy = client.get("/api/v1/rankings", params={"game": "acid_rain", "difficulty": "쉬움"})
    assert [row["score"] for row in easy.json()["top5"]] == [100]


def test_invalid_difficulty_query_returns_400(client):
    response = client.get("/api/v1/rankings", params={"game": "acid_rain", "difficulty": "중"})
    assert response.status_code == 400


def test_health_check(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
