"""요청·응답 스키마 — API 명세서 C장을 그대로 옮긴다.

필드명은 프런트엔드 `src/lib/types.ts`의 TS 인터페이스와 한 글자도 다르지
않게 맞췄다(snake_case 그대로). 여기서 이름이 바뀌면 프런트엔드 타입도
같이 바뀌어야 한다.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

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


class EventPayload(BaseModel):
    """방문자/이용 지표용 이벤트 기록 요청 — page_view(방문) · game_start(이용).

    닉네임 없이 익명으로 기록한다(카운팅 목적이라 누구인지는 필요 없음).
    player_key가 없는 요청도 계속 동작해야 하므로 스코어 제출과 마찬가지로
    기본값을 서버가 대신 생성한다. game·difficulty는 game_start에서만 쓰므로
    선택 필드로 두고, 아래 검증기로 event_type과의 짝이 맞는지 확인한다
    (models.Event의 ck_game_events_type_fields와 같은 규칙).
    """

    event_type: Literal["game_start", "page_view"]
    player_key: uuid.UUID = Field(default_factory=uuid.uuid4)
    game: Literal["chosung", "acid_rain"] | None = None
    difficulty: Difficulty | None = None

    @model_validator(mode="after")
    def _check_game_fields_match_event_type(self) -> "EventPayload":
        if self.event_type == "game_start" and (self.game is None or self.difficulty is None):
            raise ValueError("game_start 이벤트는 game과 difficulty가 모두 필요합니다.")
        if self.event_type == "page_view" and (self.game is not None or self.difficulty is not None):
            raise ValueError("page_view 이벤트는 game·difficulty를 보낼 수 없습니다.")
        return self


class EventResult(BaseModel):
    status: Literal["ok"] = "ok"


class GameStartCounts(BaseModel):
    chosung: int
    acid_rain: int


class StatsResponse(BaseModel):
    """관리자 통계 화면(GET /api/v1/admin/stats) 응답 — 총계만 보여준다."""

    total_page_views: int
    total_game_starts: int
    # 관리자 화면에는 더 이상 노출하지 않는다(카드 삭제, 2026-08-18) — 다만
    # API 응답에는 계속 포함해 다른 소비자와의 하위 호환을 유지한다.
    unique_visitors: int
    game_starts_by_game: GameStartCounts
    # 순 이용자 수 — game_events가 새로 생긴 이후로 게임을 시작한 브라우저
    # 수(player_key distinct). game_scores 쪽 과거 데이터는 이 값에 안 잡힌다.
    # 관리자 화면에는 더 이상 노출하지 않지만(카드 삭제, 2026-08-18)
    # average_game_starts_per_player 계산에는 계속 쓰인다.
    unique_players: int
    # 방문 횟수(total_page_views) 대비 게임 시작 횟수(total_game_starts)의 비율(%).
    # 2026-08-18부터 고유 방문자 기준이 아니라 총계 대 총계로 계산한다 — 한 번의
    # 방문에서 게임을 여러 번 시작하면 100%를 넘을 수 있다. 방문이 아직 없으면 null.
    usage_rate_percent: float | None
    # 반복 이용 강도 — 전체 게임 시작 횟수 / 고유 게임 이용자 수.
    average_game_starts_per_player: float | None
