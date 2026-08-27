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
    # rank·total_players는 "저장 시점의 즉시 스냅샷"이라 이후 제출로 바뀌지
    # 않는다(API 명세서 C-1: "저장 직후 계산해 즉시 반환") — 최종 순서는
    # GET /rankings로 별도 확인한다.
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
    # 스키마 단계 검증(정답 수 기준 조건부 최대 점수, schemas.py
    # ChosungScorePayload._check_result_consistency) — main.py의 게임·난이도별
    # 절대 상한(true 422 경로)과는 별개다. 어려움 난이도 정답 8개 기준 조건부
    # 최대 점수를 넘겼으므로 400(요청 형식 오류)으로 응답해야 한다.
    response = authorized_client.post("/api/v1/scores", json={**CHOSUNG_PAYLOAD, "score": 300})
    assert response.status_code == 400


def test_score_over_absolute_ceiling_returns_422(authorized_client):
    # main.py submit_score의 max_score_for(game, difficulty) 절대 상한 체크
    # (스키마 검증을 통과한 뒤에만 도달하는 진짜 422 경로) — 위
    # test_score_over_correct_count_max_returns_400과는 별개의 코드 경로다.
    # 초성게임은 정답 수가 10을 넘을 수 없어(스키마 상수 검증) 조건부 최대
    # 점수가 절대 상한(CHOSUNG_SCORE_MAX)과 사실상 같은 값이 되므로 이 경로를
    # 재현할 수 없다. 산성비게임은 스테이지3이 무한 생존이라 정답 수만 충분히
    # 크면 조건부 최대 점수가 ACID_RAIN_SCORE_CEILING(기본 300,000)을 넘어서
    # — 스키마 검증은 통과시키고 main.py의 절대 상한에서만 걸리는 값을 만들 수
    # 있다.
    from app.scoring_limits import ACID_RAIN_SCORE_CEILING, max_acid_rain_score_for_correct_count

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
    # 클라이언트 재시도(네트워크 오류 등)로 같은 submission_key가 두 번
    # 오더라도 기존 기록을 그대로 반환해야 한다 — 랭킹에 중복 집계되지 않음.
    submission_key = str(uuid.uuid4())
    payload = {**CHOSUNG_PAYLOAD, "submission_key": submission_key}

    first = authorized_client.post("/api/v1/scores", json=payload)
    second = authorized_client.post("/api/v1/scores", json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["score_id"] == second.json()["score_id"]
    assert second.json()["total_players"] == 1


def test_nickname_is_normalized_before_persisting(authorized_client):
    # schemas.NicknameMixin._check_nickname은 validate_nickname()으로 정규화된
    # (NFKC + trim + 연속 공백 축약) 값을 기준으로 길이·패턴을 검사한다 — 실제로
    # 저장·응답되는 값도 검증에 쓴 정규화된 값과 같아야 한다(정규화 전 원본을
    # 그대로 저장하면 검증 통과 여부와 실제 저장값이 어긋난다).
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
