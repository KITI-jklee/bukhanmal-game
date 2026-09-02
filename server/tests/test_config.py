"""config.py의 환경변수 검증."""

from __future__ import annotations


def test_trust_forwarded_for_defaults_true(monkeypatch):
    from app.config import Settings

    monkeypatch.delenv("TRUST_FORWARDED_FOR", raising=False)
    assert Settings.__dataclass_fields__["trust_forwarded_for"].default_factory() is True


def test_trust_forwarded_for_can_be_disabled(monkeypatch):
    from app.config import Settings

    monkeypatch.setenv("TRUST_FORWARDED_FOR", "false")
    assert Settings.__dataclass_fields__["trust_forwarded_for"].default_factory() is False
