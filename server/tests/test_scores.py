"""C-1 POST /api/v1/scores 검증."""

from __future__ import annotations

import uuid

CHOSUNG_PAYLOAD = {
    "nickname": "테스터",
    "game": "chosung",
    "difficulty": "어려움",
    "score": 150,
    "correct_count": 8,
    "no_hint_correct_count": 6,
    "max_combo": 5,
}

ACID_RAIN_PAYLOAD = {
    "nickname": "테스터",
    "game": "acid_rain",
    "difficulty": "보통",
    "score": 1860,
    "stage_reached": 3,
    "max_combo": 14,
    "time_stop_uses": 3,
    "time_stop_clears": 8,
    "play_time_seconds": 164,
}


def test_submit_chosung_score_returns_rank_and_total(client):
    response = client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD)
    assert response.status_code == 201
    body = response.json()
    assert body["rank"] == 1
    assert body["total_players"] == 1
    assert uuid.UUID(body["score_id"])  # 유효한 UUID 문자열이어야 함


def test_submit_acid_rain_score(client):
    response = client.post("/api/v1/scores", json=ACID_RAIN_PAYLOAD)
    assert response.status_code == 201
    assert response.json()["rank"] == 1


def test_rank_is_computed_within_same_game_and_difficulty_only(client):
    # 다른 난이도 기록은 순위 계산에 영향을 주지 않아야 한다.
    # rank·total_players는 "저장 시점의 즉시 스냅샷"이라 이후 제출로 바뀌지
    # 않는다(API 명세서 C-1: "저장 직후 계산해 즉시 반환") — 최종 순서는
    # GET /rankings로 별도 확인한다.
    client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "difficulty": "쉬움", "score": 999})

    low = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 10})
    assert low.json()["rank"] == 1
    assert low.json()["total_players"] == 1  # 쉬움 999점은 다른 난이도라 집계 안 됨

    high = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 200})
    assert high.json()["rank"] == 1
    assert high.json()["total_players"] == 2

    response = client.get("/api/v1/rankings", params={"game": "chosung", "difficulty": "어려움"})
    assert [row["score"] for row in response.json()["top5"]] == [200, 10]


def test_missing_field_returns_400_not_422(client):
    payload = dict(CHOSUNG_PAYLOAD)
    del payload["score"]
    response = client.post("/api/v1/scores", json=payload)
    assert response.status_code == 400


def test_invalid_enum_returns_400(client):
    response = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "difficulty": "중"})
    assert response.status_code == 400


def test_nickname_too_long_returns_400(client):
    response = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "nickname": "가" * 11})
    assert response.status_code == 400


def test_nickname_html_tag_returns_400(client):
    response = client.post(
        "/api/v1/scores", json={**CHOSUNG_PAYLOAD, "nickname": "<script>alert(1)</script>"}
    )
    assert response.status_code == 400


def test_banned_word_nickname_returns_400(client):
    response = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "nickname": "관리자"})
    assert response.status_code == 400


def test_score_over_theoretical_max_returns_422(client):
    # 어려움 난이도 이론상 최대 209점 (139 × 1.5, 3-4 콤보 보너스 계산 근거는
    # scoring_limits.py 참고)
    response = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 300})
    assert response.status_code == 422


def test_score_at_theoretical_max_is_accepted(client):
    response = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 209})
    assert response.status_code == 201


def test_negative_score_returns_400(client):
    response = client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": -5})
    assert response.status_code == 400


def test_duplicate_submission_key_returns_same_record_without_duplicating(client):
    # 클라이언트 재시도(네트워크 오류 등)로 같은 submission_key가 두 번
    # 오더라도 기존 기록을 그대로 반환해야 한다 — 랭킹에 중복 집계되지 않음.
    submission_key = str(uuid.uuid4())
    payload = {**CHOSUNG_PAYLOAD, "submission_key": submission_key}

    first = client.post("/api/v1/scores", json=payload)
    second = client.post("/api/v1/scores", json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["score_id"] == second.json()["score_id"]
    assert second.json()["total_players"] == 1


def test_player_key_is_accepted_and_optional(client):
    # 명시적으로 보내면 그대로 쓰이고, 생략해도(기존 클라이언트 호환) 서버가
    # 대신 생성해 요청이 그대로 성공해야 한다.
    with_key = client.post(
        "/api/v1/scores", json={**CHOSUNG_PAYLOAD, "player_key": str(uuid.uuid4())}
    )
    without_key = client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD)
    assert with_key.status_code == 201
    assert without_key.status_code == 201


def test_rate_limit_returns_429(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "rate_limit_max_requests", 2)
    for _ in range(2):
        assert client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD).status_code == 201
    response = client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD)
    assert response.status_code == 429
