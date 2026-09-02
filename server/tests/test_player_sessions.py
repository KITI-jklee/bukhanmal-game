from __future__ import annotations

import uuid

from app.security import verify_player_token


def test_create_player_session_returns_matching_signed_identity(client):
    response = client.post('/api/v1/players/session')
    assert response.status_code == 200
    body = response.json()
    player_key = uuid.UUID(body['player_key'])
    assert verify_player_token(body['player_token']) == player_key


def test_player_session_endpoint_is_rate_limited(client, monkeypatch):
    from app.config import settings

    # /players/session은 event(page_view/game_start) 버킷과 분리된 자기 버킷을
    # 쓴다(코드리뷰로 발견된 텔레메트리-세션 발급 간 간섭 문제 수정) — 그 별도
    # 버킷을 패치해야 한다.
    monkeypatch.setattr(settings, 'session_rate_limit_max_requests', 1)
    assert client.post('/api/v1/players/session').status_code == 200
    assert client.post('/api/v1/players/session').status_code == 429
