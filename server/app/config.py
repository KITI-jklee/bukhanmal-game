"""환경변수 설정.

API 명세서 A-3 · 상세기획서 1-3: 인증키·연결정보는 환경변수로만 관리하고
저장소나 프런트엔드 번들에 포함하지 않는다.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

# .env가 있으면 읽어 os.environ에 채운다. 이미 설정된 실제 환경변수는
# 덮어쓰지 않는다(운영 배포 시 플랫폼이 주입한 값이 우선해야 하므로).
load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass
class Settings:
    # 개발 단계에서는 SQLite 파일 하나로 시작한다. 운영 DB(PostgreSQL 등)가
    # 정해지면 이 값만 바꾸면 된다 — 저장소 계층(database.py)이 SQLAlchemy
    # 엔진 하나에 의존하므로 상위 코드는 바뀌지 않는다.
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./scores.db")

    # 프런트엔드 개발 서버(Vite, 기본 5173)와 실제 배포 도메인을 CORS로 허용한다.
    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )

    # 점수 등록 요청 빈도 제한(API 명세서 C-1 429) — 클라이언트 IP 기준.
    rate_limit_max_requests: int = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "5"))
    rate_limit_window_seconds: float = float(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "10"))

    # 산성비게임 3단계는 무한 생존이라 이론상 최대 점수가 존재하지 않는다.
    # 명세서 D장이 요구하는 "이론상 최대 점수"를 계산할 수 없으므로, 명백히
    # 조작된 값만 걸러내는 휴리스틱 상한을 대신 둔다. 실제 최고 기록을 관찰한
    # 뒤 발주처와 협의해 조정해야 한다.
    acid_rain_score_ceiling: int = int(os.getenv("ACID_RAIN_SCORE_CEILING", "300000"))


settings = Settings()
