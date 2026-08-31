from __future__ import annotations

import os
import uuid

# app.config는 임포트 시점에 DATABASE_URL을 필수로 요구한다(운영에서 sqlite로 조용히 폴백되는 걸 막기 위함 — config.py의 _require_database_url 참고).
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin-password")
os.environ.setdefault("PLAYER_TOKEN_SECRET", "test-player-token-secret-that-is-independent")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.security import issue_player_token


@pytest.fixture()
def client():
    # 테스트마다 완전히 새로운 인메모리 DB를 쓴다.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def _get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db

    # 이전 테스트의 요청 빈도 기록이 새지 않게 초기화한다.
    original_max = settings.rate_limit_max_requests
    original_event_max = settings.event_rate_limit_max_requests
    settings.rate_limit_max_requests = 1000
    settings.event_rate_limit_max_requests = 1000

    with TestClient(app) as test_client:
        yield test_client

    settings.rate_limit_max_requests = original_max
    settings.event_rate_limit_max_requests = original_event_max
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture()
def authorized_client(client):
    """인증이 필요한 API 테스트에서만 명시적으로 사용하는 클라이언트."""
    client.headers["X-Player-Token"] = issue_player_token(uuid.uuid4())
    return client
