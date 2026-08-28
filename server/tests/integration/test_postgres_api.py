from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings
from app.database import get_db
from app.main import app
from app.security import issue_player_token

pytestmark = pytest.mark.integration

REQUIRED_TABLES = {"game_scores", "game_events", "request_limits"}


@pytest.fixture()
def postgres_client():
    raw_url = os.getenv("TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip("TEST_DATABASE_URL이 없어 PostgreSQL 통합 테스트를 건너뜁니다.")

    url = make_url(raw_url)
    if url.get_backend_name() != "postgresql":
        pytest.fail("TEST_DATABASE_URL은 PostgreSQL 연결 문자열이어야 합니다.")
    if url.drivername == "postgresql":
        url = url.set(drivername="postgresql+psycopg")

    connect_args = {"prepare_threshold": None} if url.port == 6543 else {}
    integration_engine = create_engine(
        url,
        connect_args=connect_args,
        poolclass=NullPool,
        pool_pre_ping=True,
    )

    connection = integration_engine.connect()
    transaction = connection.begin()
    missing = REQUIRED_TABLES - set(inspect(connection).get_table_names())
    if missing:
        transaction.rollback()
        connection.close()
        integration_engine.dispose()
        pytest.fail(f"테스트 DB에 스키마를 먼저 적용하세요. 누락: {', '.join(sorted(missing))}")

    testing_session = sessionmaker(
        bind=connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    def _get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    original_limits = (
        settings.rate_limit_max_requests,
        settings.event_rate_limit_max_requests,
        settings.ranking_rate_limit_max_requests,
        settings.recent_rate_limit_max_requests,
    )
    settings.rate_limit_max_requests = 1_000_000
    settings.event_rate_limit_max_requests = 1_000_000
    settings.ranking_rate_limit_max_requests = 1_000_000
    settings.recent_rate_limit_max_requests = 1_000_000
    app.dependency_overrides[get_db] = _get_db

    try:
        with TestClient(app) as client:
            player_key = uuid.uuid4()
            client.headers["X-Player-Token"] = issue_player_token(player_key)
            yield client, connection, player_key
    finally:
        app.dependency_overrides.clear()
        (
            settings.rate_limit_max_requests,
            settings.event_rate_limit_max_requests,
            settings.ranking_rate_limit_max_requests,
            settings.recent_rate_limit_max_requests,
        ) = original_limits
        if transaction.is_active:
            transaction.rollback()
        connection.close()
        integration_engine.dispose()


def _score_payload(submission_key: uuid.UUID, nickname: str, score: int = 10) -> dict:
    return {
        "submission_key": str(submission_key),
        "nickname": nickname,
        "game": "chosung",
        "difficulty": "쉬움",
        "score": score,
        "correct_count": 1,
        "no_hint_correct_count": 1,
        "max_combo": 1,
    }


def test_postgres_score_and_event_round_trip(postgres_client):
    client, connection, player_key = postgres_client
    submission_key = uuid.uuid4()
    nickname = f"pg{uuid.uuid4().hex[:6]}"

    score = client.post("/api/v1/scores", json=_score_payload(submission_key, nickname))
    assert score.status_code == 201

    event = client.post(
        "/api/v1/events",
        json={"event_type": "game_start", "game": "chosung", "difficulty": "쉬움"},
    )
    assert event.status_code == 201

    recent = client.get(
        "/api/v1/scores/recent",
        params={"game": "chosung", "difficulty": "쉬움", "limit": 1},
    )
    assert recent.status_code == 200
    assert recent.json()["records"][0]["nickname"] == nickname

    stored = connection.execute(
        text(
            "select player_key, pg_typeof(score_id)::text as id_type "
            "from game_scores where submission_key = :submission_key"
        ),
        {"submission_key": submission_key},
    ).mappings().one()
    assert stored["player_key"] == player_key
    assert stored["id_type"] == "uuid"


def test_postgres_duplicate_submission_key_is_idempotent(postgres_client):
    """같은 submission_key로 재시도해도 uq_game_scores_submission_key 제약에
    부딪혀 새 행이 생기는 대신 기존 기록을 그대로 반환해야 한다(crud.create_score
    참고) — SQLite 단위 테스트는 이 유니크 제약 경합 경로를 검증하지 않는다."""
    client, connection, _player_key = postgres_client
    submission_key = uuid.uuid4()
    nickname = f"pg{uuid.uuid4().hex[:6]}"

    first = client.post("/api/v1/scores", json=_score_payload(submission_key, nickname))
    second = client.post("/api/v1/scores", json=_score_payload(submission_key, nickname))
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["score_id"] == second.json()["score_id"]

    count = connection.execute(
        text("select count(*) from game_scores where submission_key = :submission_key"),
        {"submission_key": submission_key},
    ).scalar_one()
    assert count == 1


def test_postgres_rate_limit_enforced_via_shared_table(postgres_client):
    """request_limits 기반 요청 빈도 제한이 실제 Postgres에서 동작하는지 확인한다.
    rate_limit._enforce는 `with_for_update()` 행 잠금으로 동시 요청을 다루는데,
    SQLite 단위 테스트는 이 잠금 경로를 검증하지 못한다."""
    client, connection, _player_key = postgres_client

    original_max = settings.rate_limit_max_requests
    settings.rate_limit_max_requests = 1
    try:
        allowed = client.post(
            "/api/v1/scores", json=_score_payload(uuid.uuid4(), f"pg{uuid.uuid4().hex[:6]}")
        )
        blocked = client.post(
            "/api/v1/scores", json=_score_payload(uuid.uuid4(), f"pg{uuid.uuid4().hex[:6]}")
        )
    finally:
        settings.rate_limit_max_requests = original_max

    assert allowed.status_code == 201
    assert blocked.status_code == 429

    hits = connection.execute(text("select hits from request_limits")).scalars().all()
    assert hits == [1]
