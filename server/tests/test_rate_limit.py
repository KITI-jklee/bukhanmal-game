"""rate_limit._client_address의 X-Forwarded-For 신뢰 여부 검증 — 코드리뷰로
발견된 문제: 서버리스(Vercel) 배포에서는 request.client.host가 실제 클라이언트
IP가 아닐 수 있어, 그대로 두면 모든 사용자가 한 rate limit 버킷을 공유해
사실상 무력화될 수 있었다."""

from __future__ import annotations

import uuid

from app.security import issue_player_token

PAYLOAD = {
    "nickname": "테스터",
    "game": "chosung",
    "difficulty": "쉬움",
    "score": 10,
    "correct_count": 1,
    "no_hint_correct_count": 1,
    "max_combo": 1,
}


def test_rate_limit_treats_different_forwarded_for_as_different_clients(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "rate_limit_max_requests", 1)
    monkeypatch.setattr(settings, "trust_forwarded_for", True)
    token = issue_player_token(uuid.uuid4())

    # TestClient는 실제로는 항상 같은 루프백에서 붙지만, X-Forwarded-For를
    # 신뢰하도록 설정했으니 이 헤더 값 기준으로 버킷이 나뉘어야 한다.
    first = client.post(
        "/api/v1/scores", json=PAYLOAD,
        headers={"X-Player-Token": token, "X-Forwarded-For": "1.2.3.4"},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/scores", json=PAYLOAD,
        headers={"X-Player-Token": token, "X-Forwarded-For": "5.6.7.8"},
    )
    assert second.status_code == 201  # 다른 "IP" - 한도(1)와 무관한 별도 버킷
    third = client.post(
        "/api/v1/scores", json=PAYLOAD,
        headers={"X-Player-Token": token, "X-Forwarded-For": "1.2.3.4"},
    )
    assert third.status_code == 429  # 처음과 같은 "IP" - 한도 초과


def test_rate_limit_ignores_forwarded_for_when_untrusted(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "rate_limit_max_requests", 1)
    monkeypatch.setattr(settings, "trust_forwarded_for", False)
    token = issue_player_token(uuid.uuid4())

    first = client.post(
        "/api/v1/scores", json=PAYLOAD,
        headers={"X-Player-Token": token, "X-Forwarded-For": "1.2.3.4"},
    )
    assert first.status_code == 201
    # 헤더를 신뢰하지 않으므로 다른 X-Forwarded-For를 보내도 실제 접속 주소
    # (테스트 클라이언트 기준 동일)로만 판단해 같은 버킷에 묶여야 한다.
    second = client.post(
        "/api/v1/scores", json=PAYLOAD,
        headers={"X-Player-Token": token, "X-Forwarded-For": "5.6.7.8"},
    )
    assert second.status_code == 429
