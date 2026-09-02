"""config.py의 환경변수 검증 — 코드리뷰로 발견된 관리자 비밀번호 최소 길이
미검증 문제(player_token_secret은 32자 이상을 강제하는데 admin_password는
비어있지만 않으면 통과했다)."""

from __future__ import annotations

import pytest


def test_admin_password_rejects_short_value(monkeypatch):
    from app.config import _require_admin_password

    monkeypatch.setenv("ADMIN_PASSWORD", "short1")
    with pytest.raises(RuntimeError):
        _require_admin_password()


def test_admin_password_accepts_sufficiently_long_value(monkeypatch):
    from app.config import _require_admin_password

    monkeypatch.setenv("ADMIN_PASSWORD", "at-least-12-characters")
    assert _require_admin_password() == "at-least-12-characters"


def test_trust_forwarded_for_defaults_true(monkeypatch):
    from app.config import Settings

    monkeypatch.delenv("TRUST_FORWARDED_FOR", raising=False)
    assert Settings.__dataclass_fields__["trust_forwarded_for"].default_factory() is True


def test_trust_forwarded_for_can_be_disabled(monkeypatch):
    from app.config import Settings

    monkeypatch.setenv("TRUST_FORWARDED_FOR", "false")
    assert Settings.__dataclass_fields__["trust_forwarded_for"].default_factory() is False
