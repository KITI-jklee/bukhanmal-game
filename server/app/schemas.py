"""요청·응답 스키마 — API 명세서 C장을 그대로 옮긴다.

필드명은 프런트엔드 `src/lib/types.ts`의 TS 인터페이스와 한 글자도 다르지
않게 맞췄다(snake_case 그대로). 여기서 이름이 바뀌면 프런트엔드 타입도
같이 바뀌어야 한다.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

from .validation import validate_nickname

Difficulty = Literal["쉬움", "보통", "어려움"]


class NicknameMixin(BaseModel):
    nickname: str = Field(min_length=1, max_length=10)

    # DB 설계서(game_scores) 신규 컬럼. 프런트엔드가 브라우저별로 하나 생성해
    # localStorage에 저장하는 익명 식별자(player_key)와, 게임 결과 하나마다
    # 새로 만드는 중복 등록 방지 키(submission_key)다. 기존 클라이언트나
    # 테스트처럼 이 필드를 안 보내는 요청도 계속 동작해야 하므로 기본값으로
    # 서버가 대신 생성한다 — 다만 그 경우 player_key가 매번 달라져 "내 최근
    # 기록" 조회·submission_key 중복 방지 혜택은 받지 못한다.
    player_key: uuid.UUID = Field(default_factory=uuid.uuid4)
    submission_key: uuid.UUID = Field(default_factory=uuid.uuid4)

    @field_validator("nickname")
    @classmethod
    def _check_nickname(cls, value: str) -> str:
        # 형식·금칙어 위반은 400으로 응답해야 한다(API 명세서 C-1).
        # 여기서 걸리면 FastAPI가 RequestValidationError를 던지고,
        # main.py의 커스텀 핸들러가 422 대신 400으로 바꿔 응답한다.
        message = validate_nickname(value)
        if message is not None:
            raise ValueError(message)
        return value


class ChosungScorePayload(NicknameMixin):
    game: Literal["chosung"]
    difficulty: Difficulty
    score: int = Field(ge=0)
    correct_count: int = Field(ge=0)
    no_hint_correct_count: int = Field(ge=0)
    max_combo: int = Field(ge=0)


class AcidRainScorePayload(NicknameMixin):
    game: Literal["acid_rain"]
    difficulty: Difficulty
    score: int = Field(ge=0)
    stage_reached: int = Field(ge=1)
    max_combo: int = Field(ge=0)
    time_stop_uses: int = Field(ge=0)
    time_stop_clears: int = Field(ge=0)
    play_time_seconds: int = Field(ge=0)


# game 필드값으로 두 형태를 구분한다(판별 유니온) — 요청 본문의 game이
# "chosung"이면 위, "acid_rain"이면 아래 스키마로 파싱된다.
ScorePayload = Annotated[
    ChosungScorePayload | AcidRainScorePayload,
    Field(discriminator="game"),
]


class ScoreSubmitResult(BaseModel):
    score_id: uuid.UUID
    rank: int
    total_players: int


class RankingEntry(BaseModel):
    rank: int
    nickname: str
    score: int
    played_at: datetime
    # 산성비게임 조회 시에만 포함한다(API 명세서 C-2). 초성게임 응답에는
    # 이 필드를 만들지 않도록 model_dump(exclude_none=True)로 직렬화한다.
    stage_reached: int | None = None


class RankingResponse(BaseModel):
    game: Literal["chosung", "acid_rain"]
    difficulty: Difficulty
    top5: list[RankingEntry]


class RecentRecordEntry(BaseModel):
    score_id: uuid.UUID
    nickname: str
    score: int
    played_at: datetime
    # RankingEntry와 마찬가지로 산성비게임 조회에만 포함한다.
    stage_reached: int | None = None


class RecentRecordsResponse(BaseModel):
    game: Literal["chosung", "acid_rain"]
    difficulty: Difficulty
    records: list[RecentRecordEntry]
