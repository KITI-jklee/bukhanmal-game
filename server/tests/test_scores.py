"""C-1 POST /api/v1/scores 검증."""

from __future__ import annotations

import math
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
    "score": 1600,
    "correct_count": 40,
    "stage_reached": 3,
    "max_combo": 14,
    "time_stop_uses": 3,
    "time_stop_clears": 8,
    "play_time_seconds": 164,
}


def test_submit_chosung_score_returns_rank_and_total(authorized_client):
    response = authorized_client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD)
    assert response.status_code == 201
    body = response.json()
    assert body["rank"] == 1
    assert body["total_players"] == 1
    assert uuid.UUID(body["score_id"])  # 유효한 UUID 문자열이어야 함


def test_submit_acid_rain_score(authorized_client):
    response = authorized_client.post("/api/v1/scores", json=ACID_RAIN_PAYLOAD)
    assert response.status_code == 201
    assert response.json()["rank"] == 1


def test_rank_is_computed_within_same_game_and_difficulty_only(authorized_client):
    # 다른 난이도 기록은 순위 계산에 영향을 주지 않아야 한다.
    authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "difficulty": "쉬움", "score": 999})

    low = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 10})
    assert low.json()["rank"] == 1
    assert low.json()["total_players"] == 1  # 쉬움 999점은 다른 난이도라 집계 안 됨

    high = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 200, "correct_count": 10, "max_combo": 10})
    assert high.json()["rank"] == 1
    assert high.json()["total_players"] == 2

    response = authorized_client.get("/api/v1/rankings", params={"game": "chosung", "difficulty": "어려움"})
    assert [row["score"] for row in response.json()["top5"]] == [200, 10]


def test_missing_field_returns_400_not_422(authorized_client):
    payload = dict(CHOSUNG_PAYLOAD)
    del payload["score"]
    response = authorized_client.post("/api/v1/scores", json=payload)
    assert response.status_code == 400


def test_invalid_enum_returns_400(authorized_client):
    response = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "difficulty": "중"})
    assert response.status_code == 400


def test_nickname_too_long_returns_400(authorized_client):
    response = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "nickname": "가" * 11})
    assert response.status_code == 400


def test_nickname_html_tag_returns_400(authorized_client):
    response = authorized_client.post(
        "/api/v1/scores", json={**CHOSUNG_PAYLOAD, "nickname": "<script>alert(1)</script>"}
    )
    assert response.status_code == 400


def test_banned_word_nickname_returns_400(authorized_client):
    response = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "nickname": "관리자"})
    assert response.status_code == 400


def test_score_over_correct_count_max_returns_400(authorized_client):
    # 스키마 단계 검증(정답 수 기준 조건부 최대 점수, schemas.py ChosungScorePayload._check_result_consistency) — main.py의 게임·난이도별 절대 상한(true 422 경로)과는 별개다.
    response = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 300})
    assert response.status_code == 400


def test_score_over_absolute_ceiling_returns_422(authorized_client):
    # main.py submit_score의 max_score_for(game, difficulty) 절대 상한 체크 (스키마 검증을 통과한 뒤에만 도달하는 진짜 422 경로) — 위 test_score_over_correct_count_max_returns_400과는 별개의 코드 경로다.
    from app.scoring_limits import (
        ACID_RAIN_SCORE_CEILING,
        max_acid_rain_score_for_correct_count,
        min_acid_rain_play_time_seconds,
    )

    difficulty = "어려움"
    correct_count = ACID_RAIN_PAYLOAD["correct_count"]
    while max_acid_rain_score_for_correct_count(correct_count, difficulty) <= ACID_RAIN_SCORE_CEILING:
        correct_count *= 2
    score = ACID_RAIN_SCORE_CEILING + 1
    assert score <= max_acid_rain_score_for_correct_count(correct_count, difficulty)

    response = authorized_client.post(
        "/api/v1/scores",
        json={
            **ACID_RAIN_PAYLOAD,
            "difficulty": difficulty,
            "correct_count": correct_count,
            "stage_reached": 3,
            "max_combo": correct_count,
            "time_stop_clears": 0,
            "score": score,
            # correct_count를 위에서 크게 불렸으니 시간-정답수 정합성 검증(422보다
            # 앞서 걸리는 400)을 안 건드리도록 물리적 최소 시간 이상으로 맞춘다.
            "play_time_seconds": math.ceil(min_acid_rain_play_time_seconds(correct_count)) + 10,
        },
    )
    assert response.status_code == 422


def test_score_at_theoretical_max_is_accepted(authorized_client):
    response = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 209, "correct_count": 10, "max_combo": 10})
    assert response.status_code == 201


def test_negative_score_returns_400(authorized_client):
    response = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": -5})
    assert response.status_code == 400


def test_duplicate_submission_key_returns_same_record_without_duplicating(authorized_client):
    # 클라이언트 재시도(네트워크 오류 등)로 같은 submission_key가 두 번 오더라도 기존 기록을 그대로 반환해야 한다 — 랭킹에 중복 집계되지 않음.
    submission_key = str(uuid.uuid4())
    payload = {**CHOSUNG_PAYLOAD, "submission_key": submission_key}

    first = authorized_client.post("/api/v1/scores", json=payload)
    second = authorized_client.post("/api/v1/scores", json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["score_id"] == second.json()["score_id"]
    assert second.json()["total_players"] == 1


def test_nickname_is_normalized_before_persisting(authorized_client):
    # 검증에 사용한 정규화 값이 그대로 저장되어야 한다.
    response = authorized_client.post(
        "/api/v1/scores", json={**CHOSUNG_PAYLOAD, "nickname": "  테스 터  "}
    )
    assert response.status_code == 201

    ranking = authorized_client.get(
        "/api/v1/rankings", params={"game": "chosung", "difficulty": "어려움"}
    )
    assert ranking.json()["top5"][0]["nickname"] == "테스 터"


def test_score_requires_player_token(client):
    assert client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD).status_code == 400


def test_body_player_key_is_ignored(authorized_client):
    # 본문의 player_key는 인증에 사용하지 않으며 서명 토큰의 키만 신뢰한다.
    with_key = authorized_client.post(
        "/api/v1/scores", json={**CHOSUNG_PAYLOAD, "player_key": str(uuid.uuid4())}
    )
    without_key = authorized_client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD)
    assert with_key.status_code == 201
    assert without_key.status_code == 201


def test_rate_limit_returns_429(authorized_client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "rate_limit_max_requests", 2)
    for _ in range(2):
        assert authorized_client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD).status_code == 201
    response = authorized_client.post("/api/v1/scores", json=CHOSUNG_PAYLOAD)
    assert response.status_code == 429


def test_chosung_rejects_inconsistent_result_fields(authorized_client):
    response = authorized_client.post(
        "/api/v1/scores",
        json={**CHOSUNG_PAYLOAD, "score": 209, "correct_count": 0, "max_combo": 0},
    )
    assert response.status_code == 400


def test_acid_rain_rejects_inconsistent_result_fields(authorized_client):
    response = authorized_client.post(
        "/api/v1/scores",
        json={**ACID_RAIN_PAYLOAD, "stage_reached": 1, "correct_count": 40},
    )
    assert response.status_code == 400


def test_acid_rain_rejects_physically_impossible_play_time(authorized_client):
    # 정답 500개를 1초 만에 냈다고 주장 - 점수/콤보/스테이지 범위는 다 통과할 수
    # 있어도(코드리뷰로 발견된 안티치트 공백), 단어 생성 간격상 물리적으로
    # 불가능하므로 400으로 막혀야 한다.
    response = authorized_client.post(
        "/api/v1/scores",
        json={
            **ACID_RAIN_PAYLOAD,
            "correct_count": 500,
            "stage_reached": 3,
            "max_combo": 500,
            "score": 1,
            "play_time_seconds": 1,
        },
    )
    assert response.status_code == 400
