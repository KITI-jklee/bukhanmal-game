from __future__ import annotations

import os
import uuid

# app.config는 임포트 시점에 DATABASE_URL을 필수로 요구한다(운영에서 sqlite로
# 조용히 폴백되는 걸 막기 위함 — config.py의 _require_database_url 참고).
# 테스트는 실제 DB에 붙지 않고 아래 client 픽스처가 만드는 별도의 인메모리
# 엔진(get_db override)만 쓰므로, 임포트가 막히지 않게 더미 값만 채워 둔다.
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
    # 테스트마다 완전히 새로운 인메모리 DB를 쓴다. StaticPool로 커넥션을
    # 하나만 유지해야 ":memory:" 안의 테이블이 요청 사이에 사라지지 않는다.
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

    # 이전 테스트의 요청 빈도 기록이 새지 않게 초기화한다. 또한 대부분의
    # 테스트는 여러 건을 연속 저장하므로 기본 제한(5회/10초)에 걸리지 않도록
    # 넉넉히 풀어둔다 — 429 자체는 test_rate_limit_returns_429가 따로 검증한다.
    original_max = settings.rate_limit_max_requests
    original_event_max = settings.event_rate_limit_max_requests
    settings.rate_limit_max_requests = 1000
    settings.event_rate_limit_max_requests = 1000

    with TestClient(app) as test_client:
        yield test_client

    settings.rate_limit_max_requests = original_max
    settings.event_rate_limit_max_requests = original_event_max
    app.dependency_overrides.clear()


@pytest.fixture()
def authorized_client(client):
    """인증이 필요한 API 테스트에서만 명시적으로 사용하는 클라이언트."""
    client.headers["X-Player-Token"] = issue_player_token(uuid.uuid4())
    return client
