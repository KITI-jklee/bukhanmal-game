"""POST /api/v1/events 검증 — 방문자(page_view)·이용(game_start) 지표 이벤트 기록."""

from __future__ import annotations

import uuid

GAME_START_PAYLOAD = {
    "event_type": "game_start",
    "game": "chosung",
    "difficulty": "보통",
}

PAGE_VIEW_PAYLOAD = {"event_type": "page_view"}


def test_submit_game_start_event_returns_ok(client):
    response = client.post("/api/v1/events", json=GAME_START_PAYLOAD)
    assert response.status_code == 201
    assert response.json() == {"status": "ok"}


def test_submit_page_view_event_returns_ok(client):
    response = client.post("/api/v1/events", json=PAGE_VIEW_PAYLOAD)
    assert response.status_code == 201
    assert response.json() == {"status": "ok"}


def test_repeated_game_start_events_all_recorded(client):
    # game_scores와 달리 dedup 키가 없다 — 같은 플레이어가 여러 판 시작하면
    # 매번 새 행으로 쌓여야 한다(조회수 방식 카운팅).
    player_key = str(uuid.uuid4())
    for _ in range(3):
        response = client.post(
            "/api/v1/events", json={**GAME_START_PAYLOAD, "player_key": player_key}
        )
        assert response.status_code == 201


def test_game_start_event_defaults_player_key_when_omitted(client):
    # player_key를 안 보내는 요청도 계속 동작해야 한다(스코어 제출과 동일한 계약).
    response = client.post("/api/v1/events", json=GAME_START_PAYLOAD)
    assert response.status_code == 201


def test_unknown_event_type_is_rejected(client):
    response = client.post(
        "/api/v1/events", json={**GAME_START_PAYLOAD, "event_type": "click"}
    )
    assert response.status_code == 400


def test_missing_game_is_rejected(client):
    payload = {"event_type": "game_start", "difficulty": "보통"}
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 400


def test_page_view_with_game_field_is_rejected(client):
    # page_view는 게임과 무관한 이벤트라 game·difficulty를 같이 보내면 안 된다.
    response = client.post(
        "/api/v1/events", json={"event_type": "page_view", "game": "chosung"}
    )
    assert response.status_code == 400
