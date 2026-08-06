"""점수 등록 요청 빈도 제한 — API 명세서 C-1 429.

지금은 단일 프로세스 인메모리 구현이다. 여러 워커·인스턴스로 확장하면
클라이언트별 요청 기록이 프로세스마다 따로 쌓여 제한이 헐거워지므로,
그 시점에는 Redis 등 공유 저장소로 옮겨야 한다(README에 남겨둔다).
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from .config import settings

_hits: dict[str, list[float]] = defaultdict(list)


def enforce_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window_start = now - settings.rate_limit_window_seconds

    recent = [t for t in _hits[client_ip] if t >= window_start]
    if len(recent) >= settings.rate_limit_max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
        )

    recent.append(now)
    _hits[client_ip] = recent
