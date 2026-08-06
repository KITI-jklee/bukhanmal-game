from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import rate_limit
from app.config import settings
from app.database import Base, get_db
from app.main import app


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
    rate_limit._hits.clear()
    original_max = settings.rate_limit_max_requests
    settings.rate_limit_max_requests = 1000

    with TestClient(app) as test_client:
        yield test_client

    settings.rate_limit_max_requests = original_max
    app.dependency_overrides.clear()
