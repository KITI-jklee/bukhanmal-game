"""요청·응답 스키마 — API 명세서 C장을 그대로 옮긴다.

필드명은 프런트엔드 `src/lib/types.ts`의 TS 인터페이스와 한 글자도 다르지
않게 맞췄다(snake_case 그대로). 여기서 이름이 바뀌면 프런트엔드 타입도
같이 바뀌어야 한다.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .scoring_limits import (
    ACID_RAIN_STAGE1_MAX_CORRECT,
    ACID_RAIN_STAGE2_MAX_CORRECT,
    max_acid_rain_score_for_correct_count,
    max_chosung_score_for_correct_count,
    min_acid_rain_play_time_seconds,
)
from .validation import normalize_nickname, validate_nickname

Difficulty = Literal["쉬움", "보통", "어려움"]
GameType = Literal["chosung", "acid_rain"]


class RequestModel(BaseModel):
    """요청 본문 스키마 공통 베이스.

    extra="ignore"는 Pydantic 기본값과 같지만, 여기서 명시해서 알 수 없는
    JSON 필드(예: 본문의 player_key — 인증에는 서명된 X-Player-Token
    헤더만 쓴다)가 조용히 무시된다는 걸 문서로 남긴다.
    tests/test_scores.py::test_body_player_key_is_ignored가 이 동작을 검증한다.
    """

    model_config = ConfigDict(extra="ignore")


class NicknameMixin(RequestModel):
    nickname: str = Field(min_length=1, max_length=10)

    # 결과 하나마다 생성하는 중복 등록 방지 키.
    submission_key: uuid.UUID = Field(default_factory=uuid.uuid4)

    @field_validator("nickname")
    @classmethod
    def _check_nickname(cls, value: str) -> str:
        # 형식·금칙어 위반은 400으로 응답해야 한다(API 명세서 C-1).
        message = validate_nickname(value)
        if message is not None:
            raise ValueError(message)
        # 검증과 저장에 같은 정규화 값을 사용한다.
        return normalize_nickname(value)


class ChosungScorePayload(NicknameMixin):
    game: Literal["chosung"]
    difficulty: Difficulty
    score: int = Field(ge=0)
    correct_count: int = Field(ge=0)
    no_hint_correct_count: int = Field(ge=0)
    max_combo: int = Field(ge=0)

    @model_validator(mode="after")
    def _check_result_consistency(self) -> "ChosungScorePayload":
        if self.correct_count > 10:
            raise ValueError("초성게임 정답 수는 10개를 초과할 수 없습니다.")
        if self.no_hint_correct_count > self.correct_count:
            raise ValueError("무힌트 정답 수는 전체 정답 수를 초과할 수 없습니다.")
        if self.max_combo > self.correct_count:
            raise ValueError("최대 콤보는 정답 수를 초과할 수 없습니다.")
        maximum = max_chosung_score_for_correct_count(self.correct_count, self.difficulty)
        if self.score > maximum:
            raise ValueError(f"정답 수로 얻을 수 있는 최대 점수({maximum}점)를 초과했습니다.")
        return self


class AcidRainScorePayload(NicknameMixin):
    game: Literal["acid_rain"]
    difficulty: Difficulty
    score: int = Field(ge=0)
    correct_count: int = Field(ge=0)
    stage_reached: int = Field(ge=1)
    max_combo: int = Field(ge=0)
    time_stop_uses: int = Field(ge=0)
    time_stop_clears: int = Field(ge=0)
    play_time_seconds: int = Field(ge=0)

    @model_validator(mode="after")
    def _check_result_consistency(self) -> "AcidRainScorePayload":
        if self.max_combo > self.correct_count:
            raise ValueError("최대 콤보는 정답 수를 초과할 수 없습니다.")
        if self.time_stop_clears > self.correct_count:
            raise ValueError("시간정지 중 제거 수는 전체 정답 수를 초과할 수 없습니다.")
        if self.stage_reached == 1 and self.correct_count >= ACID_RAIN_STAGE1_MAX_CORRECT:
            raise ValueError(
                f"정답 수가 {ACID_RAIN_STAGE1_MAX_CORRECT}개 이상이면 1단계 기록일 수 없습니다."
            )
        if self.stage_reached == 2 and not (
            ACID_RAIN_STAGE1_MAX_CORRECT <= self.correct_count < ACID_RAIN_STAGE2_MAX_CORRECT
        ):
            raise ValueError("2단계 기록의 정답 수 범위가 올바르지 않습니다.")
        if self.stage_reached == 3 and self.correct_count < ACID_RAIN_STAGE2_MAX_CORRECT:
            raise ValueError(
                f"3단계 기록은 최소 {ACID_RAIN_STAGE2_MAX_CORRECT}개의 정답이 필요합니다."
            )
        # 정답 수만으로는 "짧은 시간에 비정상적으로 많이 맞혔다"를 걸러내지
        # 못한다(예: correct_count=500, play_time_seconds=1도 위 검증들은 통과함) -
        # 단어 생성 간격상 물리적으로 불가능한 play_time_seconds를 별도로 막는다.
        min_seconds = min_acid_rain_play_time_seconds(self.correct_count)
        if self.play_time_seconds < min_seconds:
            raise ValueError(
                f"정답 수({self.correct_count}개)에 비해 플레이 시간이 너무 짧습니다 "
                f"(최소 {min_seconds:.1f}초 필요)."
            )
        maximum = max_acid_rain_score_for_correct_count(self.correct_count, self.difficulty)
        if self.score > maximum:
            raise ValueError(f"정답 수로 얻을 수 있는 최대 점수({maximum}점)를 초과했습니다.")
        return self


# game 필드값으로 두 형태를 구분한다(판별 유니온) — 요청 본문의 game이 "chosung"이면 위, "acid_rain"이면 아래 스키마로 파싱된다.
ScorePayload = Annotated[
    ChosungScorePayload | AcidRainScorePayload,
    Field(discriminator="game"),
]


class PlayerSessionResult(BaseModel):
    player_key: uuid.UUID
    player_token: str

class ScoreSubmitResult(BaseModel):
    score_id: uuid.UUID
    rank: int
    total_players: int


class RankingEntry(BaseModel):
    rank: int
    nickname: str
    score: int
    played_at: datetime
    # 산성비게임 조회 시에만 포함한다(API 명세서 C-2).
    stage_reached: int | None = None


class RankingResponse(BaseModel):
    game: GameType
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
    game: GameType
    difficulty: Difficulty
    records: list[RecentRecordEntry]


class EventPayload(RequestModel):
    """방문자/이용 지표용 이벤트 기록 요청 — page_view(방문) · game_start(이용).

    닉네임 없이 익명으로 기록한다. 플레이어 식별자는 요청 본문이 아니라
    서명된 X-Player-Token 헤더에서만 가져온다. game·difficulty는 game_start에서만 쓰므로
    선택 필드로 두고, 아래 검증기로 event_type과의 짝이 맞는지 확인한다
    (models.Event의 ck_game_events_type_fields와 같은 규칙).
    """

    event_type: Literal["game_start", "page_view"]
    game: GameType | None = None
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
    # 관리자 화면에는 더 이상 노출하지 않는다(카드 삭제, 2026-08-18) — 다만 API 응답에는 계속 포함해 다른 소비자와의 하위 호환을 유지한다.
    unique_visitors: int
    game_starts_by_game: GameStartCounts
    # 순 이용자 수 — game_events가 새로 생긴 이후로 게임을 시작한 브라우저 수(player_key distinct).
    unique_players: int
    # 방문 횟수(total_page_views) 대비 게임 시작 횟수(total_game_starts)의 비율(%).
    usage_rate_percent: float | None
    # 반복 이용 강도 — 전체 게임 시작 횟수 / 고유 게임 이용자 수.
    average_game_starts_per_player: float | None
