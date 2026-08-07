"""점수 테이블 — 통일_워드게임_DB_설계서(03_game_scores·08_DDL) 기준.

game_scores로 이름이 바뀌었고, player_key(익명 플레이어 식별)·submission_key
(중복 등록 방지)가 추가됐다. score_id는 문자열이 아니라 UUID다.

게임별 전용 필드(초성: correct_count·no_hint_correct_count / 산성비:
stage_reached·time_stop_uses·time_stop_clears·play_time_seconds)는 서로
쓰지 않는 쪽에서는 NULL로 둔다. 두 게임을 한 테이블에 두는 이유는 랭킹
조회가 어차피 game_type·difficulty로 필터링해서 쓰기 때문— 굳이 테이블을
나눠서 UNION으로 다시 합칠 이유가 없다.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, SmallInteger, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Score(Base):
    __tablename__ = "game_scores"
    __table_args__ = (
        CheckConstraint(
            # Postgres char_length() 대신 length()를 쓴다 — 텍스트 컬럼에서는
            # 결과가 같고, sqlite(테스트 환경)에는 char_length()가 없다.
            "length(trim(nickname)) between 1 and 10",
            name="ck_game_scores_nickname",
        ),
        CheckConstraint(
            "game_type in ('chosung', 'acid_rain')",
            name="ck_game_scores_game_type",
        ),
        # 설계서 원본: check (difficulty in ('하', '중', '상')) — 위 docstring 참고
        CheckConstraint(
            "difficulty in ('쉬움', '보통', '어려움')",
            name="ck_game_scores_difficulty",
        ),
        CheckConstraint(
            "score >= 0 and correct_count >= 0 and max_combo >= 0"
            " and (no_hint_correct_count is null or no_hint_correct_count >= 0)"
            " and (time_stop_uses is null or time_stop_uses >= 0)"
            " and (time_stop_clears is null or time_stop_clears >= 0)"
            " and (play_time_seconds is null or play_time_seconds >= 0)",
            name="ck_game_scores_nonnegative",
        ),
        CheckConstraint(
            "stage_reached is null or stage_reached between 1 and 3",
            name="ck_game_scores_stage",
        ),
        CheckConstraint(
            "(game_type = 'chosung'"
            " and stage_reached is null"
            " and time_stop_uses is null"
            " and time_stop_clears is null"
            " and play_time_seconds is null)"
            " or"
            " (game_type = 'acid_rain'"
            " and no_hint_correct_count is null"
            " and stage_reached is not null)",
            name="ck_game_scores_game_fields",
        ),
        Index("idx_game_scores_leaderboard", "game_type", "difficulty", "score", "played_at"),
        Index("idx_game_scores_player_recent", "player_key", "played_at"),
    )

    def _new_score_id() -> uuid.UUID:  # noqa: N805 - SQLAlchemy default factory, no self
        return uuid.uuid4()

    score_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_new_score_id)
    player_key: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    submission_key: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, unique=True)
    nickname: Mapped[str] = mapped_column(String(10), nullable=False)
    game_type: Mapped[str] = mapped_column(String(20), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(5), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # 초성게임 전용 (+ correct_count는 공통, 산성비는 일반 단어 정답 수로 씀)
    correct_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    no_hint_correct_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    max_combo: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    # 산성비게임 전용
    stage_reached: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    time_stop_uses: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    time_stop_clears: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    play_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
