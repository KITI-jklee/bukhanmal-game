"""서명된 익명 플레이어 토큰의 무결성·만료 검증."""

import uuid

import pytest
from fastapi import HTTPException

from app.config import settings
from app.security import issue_player_token, verify_player_token


def test_player_token_round_trip():
    player_key = uuid.uuid4()
    assert verify_player_token(issue_player_token(player_key)) == player_key


def test_player_token_expires(monkeypatch):
    import app.security as security

    monkeypatch.setattr(settings, "player_token_ttl_seconds", 60)
    monkeypatch.setattr(security.time, "time", lambda: 1_000)
    token = issue_player_token(uuid.uuid4())
    monkeypatch.setattr(security.time, "time", lambda: 1_061)

    with pytest.raises(HTTPException) as exc:
        verify_player_token(token)
    assert exc.value.status_code == 401


def test_player_token_rejects_future_timestamp(monkeypatch):
    import app.security as security

    monkeypatch.setattr(security.time, "time", lambda: 2_000)
    token = issue_player_token(uuid.uuid4())
    monkeypatch.setattr(security.time, "time", lambda: 1_000)

    with pytest.raises(HTTPException) as exc:
        verify_player_token(token)
    assert exc.value.status_code == 401