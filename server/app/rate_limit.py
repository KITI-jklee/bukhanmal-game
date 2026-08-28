"""모든 서버리스 인스턴스가 공유하는 DB 기반 요청 빈도 제한."""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .db_utils import insert_or_recover
from .models import RequestLimit


def _client_bucket(request: Request, scope: str) -> str:
    address = request.client.host if request.client else "unknown"
    return hashlib.sha256(f"{scope}:{address}".encode()).hexdigest()


def _enforce(request: Request, db: Session, scope: str, maximum: int, seconds: float) -> None:
    key = _client_bucket(request, scope)
    now = datetime.now(UTC)
    # 정리 DELETE를 모든 요청에서 실행하지 않고 약 1% 요청에서만 수행한다.
    if secrets.randbelow(100) == 0:
        cutoff = now - timedelta(seconds=settings.rate_limit_retention_seconds)
        db.execute(delete(RequestLimit).where(RequestLimit.window_started_at < cutoff))
    row = db.scalar(
        select(RequestLimit).where(RequestLimit.bucket_key == key).with_for_update()
    )
    if row is None:
        new_row = RequestLimit(bucket_key=key, window_started_at=now, hits=1)
        row = insert_or_recover(
            db,
            new_row,
            lambda: db.scalar(
                select(RequestLimit).where(RequestLimit.bucket_key == key).with_for_update()
            ),
            refresh=False,
        )
        if row is new_row:
            # 경합 없이 새 버킷을 만들었다 — 이미 커밋했고 hits=1이라 더 할 일이 없다.
            return
        # 동시 요청이 먼저 버킷을 만들었다 — 그 행을 이번 요청 몫까지 반영하도록 아래 공통 로직(윈도우 만료·상한 체크·hits 증가)으로 그대로 넘어간다.
    started = row.window_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    if now - started >= timedelta(seconds=seconds):
        row.window_started_at = now
        row.hits = 1
    elif row.hits >= maximum:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        )
    else:
        row.hits += 1
    db.commit()


def enforce_rate_limit(request: Request, db: Session = Depends(get_db)) -> None:
    _enforce(request, db, "score", settings.rate_limit_max_requests, settings.rate_limit_window_seconds)


def enforce_event_rate_limit(request: Request, db: Session = Depends(get_db)) -> None:
    _enforce(request, db, "event", settings.event_rate_limit_max_requests, settings.event_rate_limit_window_seconds)


def enforce_admin_rate_limit(request: Request, db: Session = Depends(get_db)) -> None:
    _enforce(request, db, "admin", settings.admin_rate_limit_max_requests, settings.admin_rate_limit_window_seconds)


def enforce_ranking_rate_limit(request: Request, db: Session = Depends(get_db)) -> None:
    _enforce(request, db, "ranking", settings.ranking_rate_limit_max_requests, settings.ranking_rate_limit_window_seconds)


def enforce_recent_rate_limit(request: Request, db: Session = Depends(get_db)) -> None:
    _enforce(request, db, "recent", settings.recent_rate_limit_max_requests, settings.recent_rate_limit_window_seconds)
