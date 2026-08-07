"""통일 워드게임 백엔드 — API 명세서 C장(점수 저장·TOP 5 조회).

게임 클라이언트가 런타임에 의존하는 API는 이것뿐이다(B장 정적 JSON은
빌드에 포함되고, A장 공공 API는 수집 스크립트만 호출한다).
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .config import settings
from .crud import create_score, rank_of, recent_records, top5
from .database import Base, engine, get_db
from .rate_limit import enforce_rate_limit
from .scoring_limits import max_score_for
from .schemas import (
    Difficulty,
    RankingEntry,
    RankingResponse,
    RecentRecordEntry,
    RecentRecordsResponse,
    ScorePayload,
    ScoreSubmitResult,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 로컬 개발용 sqlite는 편의상 여기서 자동으로 테이블을 만든다. Postgres
    # (Supabase)는 스키마를 supabase_schema.sql로 직접 관리한다 — CHECK
    # 제약·인덱스·랭킹 뷰·RLS까지 포함돼 있어 SQLAlchemy의 create_all로는
    # 재현이 안 되고, 매 기동마다 원격 DB에 introspection 쿼리를 보낼
    # 이유도 없다(테스트에서 TestClient를 만들 때마다 이 lifespan이 돌아서,
    # DATABASE_URL이 Supabase를 가리키면 테스트가 매번 네트워크를 타는 문제도
    # 같이 없앤다).
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="통일 워드게임 API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """스키마 검증 실패는 422 대신 400으로 응답한다 — API 명세서 C-1 오류표.

    422는 점수 범위 이상치 전용으로 남겨둔다(필수 필드 누락·닉네임 형식
    위반·열거값 오류는 400).
    """
    messages = [error["msg"].removeprefix("Value error, ") for error in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": " / ".join(messages) or "요청 형식이 올바르지 않습니다."},
    )


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/scores", response_model=ScoreSubmitResult, status_code=status.HTTP_201_CREATED)
def submit_score(
    payload: ScorePayload,
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(enforce_rate_limit),
) -> ScoreSubmitResult:
    max_allowed = max_score_for(payload.game, payload.difficulty)
    if payload.score > max_allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"이 게임·난이도의 이론상 최대 점수({max_allowed}점)를 초과했습니다.",
        )

    row = create_score(db, payload)
    rank, total_players = rank_of(db, row)
    return ScoreSubmitResult(score_id=row.score_id, rank=rank, total_players=total_players)


@app.get("/api/v1/rankings", response_model=RankingResponse, response_model_exclude_none=True)
def get_rankings(
    game: Literal["chosung", "acid_rain"],
    difficulty: Difficulty,
    db: Session = Depends(get_db),
) -> RankingResponse:
    rows = top5(db, game, difficulty)
    entries = [
        RankingEntry(
            rank=index + 1,
            nickname=row.nickname,
            score=row.score,
            played_at=row.played_at,
            # 산성비게임 조회에만 도달 스테이지를 포함한다(API 명세서 C-2).
            stage_reached=row.stage_reached if game == "acid_rain" else None,
        )
        for index, row in enumerate(rows)
    ]
    return RankingResponse(game=game, difficulty=difficulty, top5=entries)


@app.get(
    "/api/v1/scores/recent",
    response_model=RecentRecordsResponse,
    response_model_exclude_none=True,
)
def get_recent_records(
    player_key: uuid.UUID,
    game: Literal["chosung", "acid_rain"],
    difficulty: Difficulty,
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> RecentRecordsResponse:
    """API 명세서 06_API_DB매핑: 내 최근 기록 — nickname이 아닌 player_key 기준."""
    rows = recent_records(db, player_key, game, difficulty, limit)
    records = [
        RecentRecordEntry(
            score_id=row.score_id,
            nickname=row.nickname,
            score=row.score,
            played_at=row.played_at,
            stage_reached=row.stage_reached if game == "acid_rain" else None,
        )
        for row in rows
    ]
    return RecentRecordsResponse(game=game, difficulty=difficulty, records=records)
