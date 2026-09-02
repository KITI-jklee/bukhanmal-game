"""환경변수 설정.

API 명세서 A-3 · 상세기획서 1-3: 인증키·연결정보는 환경변수로만 관리하고
저장소나 프런트엔드 번들에 포함하지 않는다.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

# .env가 있으면 읽어 os.environ에 채운다.
load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _require_admin_password() -> str:
    # 관리자 통계 페이지(/api/v1/admin/stats)를 지키는 단일 공유 비밀번호.
    value = os.getenv("ADMIN_PASSWORD")
    if not value:
        raise RuntimeError(
            "ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다. "
            "관리자 통계 화면 보호용 비밀번호를 .env(로컬) 또는 배포 플랫폼의 "
            "환경변수로 설정하세요."
        )
    return value


def _require_int(name: str, default: str) -> int:
    """정수 환경변수를 읽는다. 값이 있는데 정수로 파싱이 안 되면 원래
    int()가 던지는 날것의 ValueError 트레이스백 대신, 어떤 환경변수가
    문제인지 바로 알 수 있는 RuntimeError를 낸다."""
    raw = os.getenv(name, default)
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} 환경변수는 정수여야 합니다 (현재 값: {raw!r}).") from exc


def _require_float(name: str, default: str) -> float:
    """_require_int와 같은 이유로 실수 환경변수를 검증하며 읽는다."""
    raw = os.getenv(name, default)
    try:
        return float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} 환경변수는 숫자여야 합니다 (현재 값: {raw!r}).") from exc


def _require_player_token_secret() -> str:
    value = os.getenv("PLAYER_TOKEN_SECRET")
    if not value or len(value) < 32 or value == os.getenv("ADMIN_PASSWORD"):
        raise RuntimeError(
            "PLAYER_TOKEN_SECRET은 관리자 비밀번호와 다른 32자 이상의 "
            "무작위 값이어야 합니다."
        )
    return value


def _require_database_url() -> str:
    # sqlite 파일 폴백을 두지 않는다 — Vercel 등 서버리스 배포는 파일시스템이 요청마다 초기화/읽기전용이라 sqlite 파일이 운영 DB로 동작할 수 없다.
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError(
            "DATABASE_URL 환경변수가 설정되어 있지 않습니다. "
            "Supabase 연결 문자열을 .env(로컬) 또는 배포 플랫폼의 환경변수로 설정하세요. "
            "예: postgresql+psycopg://user:pass@host:6543/postgres"
        )
    return value


@dataclass
class Settings:
    # 운영 DB(Supabase Postgres)가 이미 정해졌으므로 이 값은 필수다 — 아래 _require_database_url() 참고.
    database_url: str = field(default_factory=_require_database_url)

    # 관리자 통계 화면(/api/v1/admin/stats) 보호용 — _require_admin_password() 참고.
    admin_password: str = field(default_factory=_require_admin_password)
    player_token_secret: str = field(default_factory=_require_player_token_secret)
    player_token_ttl_seconds: int = field(
        default_factory=lambda: _require_int("PLAYER_TOKEN_TTL_SECONDS", "2592000")
    )

    # 프런트엔드 개발 서버(Vite, 기본 5173)와 실제 배포 도메인을 CORS로 허용한다.
    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )

    # 점수 등록 요청 빈도 제한(API 명세서 C-1 429) — 클라이언트 IP 기준.
    rate_limit_max_requests: int = field(default_factory=lambda: _require_int("RATE_LIMIT_MAX_REQUESTS", "5"))
    rate_limit_window_seconds: float = field(
        default_factory=lambda: _require_float("RATE_LIMIT_WINDOW_SECONDS", "10")
    )
    event_rate_limit_max_requests: int = field(
        default_factory=lambda: _require_int("EVENT_RATE_LIMIT_MAX_REQUESTS", "30")
    )
    event_rate_limit_window_seconds: float = field(
        default_factory=lambda: _require_float("EVENT_RATE_LIMIT_WINDOW_SECONDS", "60")
    )
    # /players/session은 예전엔 "event" 버킷을 같이 썼는데, page_view/game_start
    # 텔레메트리 폭주만으로 이 버킷이 소진되면 점수 제출에 꼭 필요한 세션 발급까지
    # 막혀버렸다(코드리뷰로 발견) - 별도 버킷으로 분리한다. 세션은 발급되면
    # localStorage에 캐시돼 매 요청마다 다시 부르지 않으므로 더 여유 있게 잡는다.
    session_rate_limit_max_requests: int = field(
        default_factory=lambda: _require_int("SESSION_RATE_LIMIT_MAX_REQUESTS", "30")
    )
    session_rate_limit_window_seconds: float = field(
        default_factory=lambda: _require_float("SESSION_RATE_LIMIT_WINDOW_SECONDS", "60")
    )
    admin_rate_limit_max_requests: int = field(
        default_factory=lambda: _require_int("ADMIN_RATE_LIMIT_MAX_REQUESTS", "10")
    )
    admin_rate_limit_window_seconds: float = field(
        default_factory=lambda: _require_float("ADMIN_RATE_LIMIT_WINDOW_SECONDS", "300")
    )
    rate_limit_retention_seconds: float = field(
        default_factory=lambda: _require_float("RATE_LIMIT_RETENTION_SECONDS", "86400")
    )
    ranking_rate_limit_max_requests: int = field(
        default_factory=lambda: _require_int("RANKING_RATE_LIMIT_MAX_REQUESTS", "120")
    )
    ranking_rate_limit_window_seconds: float = field(
        default_factory=lambda: _require_float("RANKING_RATE_LIMIT_WINDOW_SECONDS", "60")
    )
    recent_rate_limit_max_requests: int = field(
        default_factory=lambda: _require_int("RECENT_RATE_LIMIT_MAX_REQUESTS", "60")
    )
    recent_rate_limit_window_seconds: float = field(
        default_factory=lambda: _require_float("RECENT_RATE_LIMIT_WINDOW_SECONDS", "60")
    )

    # 산성비게임 3단계는 무한 생존이라 이론상 최대 점수가 존재하지 않는다.
    acid_rain_score_ceiling: int = field(
        default_factory=lambda: _require_int("ACID_RAIN_SCORE_CEILING", "300000")
    )

    # Vercel 같은 서버리스 플랫폼은 요청이 항상 엣지 프록시를 거쳐 들어와서,
    # 손대지 않으면 request.client.host가 실제 클라이언트 IP가 아니라 내부 홉을
    # 가리킬 수 있다(그러면 모든 사용자가 한 rate limit 버킷을 공유하게 되어
    # 사실상 무력화된다) - X-Forwarded-For의 첫 값을 신뢰해 실제 IP로 쓴다.
    # 신뢰할 수 있는 프록시 없이 앱이 직접 노출되는 배포(그 헤더를 클라이언트가
    # 마음대로 조작할 수 있는 환경)에서는 반드시 false로 꺼야 한다.
    trust_forwarded_for: bool = field(
        default_factory=lambda: os.getenv("TRUST_FORWARDED_FOR", "true").strip().lower()
        not in ("0", "false", "no")
    )


settings = Settings()
