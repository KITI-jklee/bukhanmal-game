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


class Event(Base):
    """방문자/이용 지표용 이벤트 로그. 두 가지 event_type을 쌓는다.

    - page_view: 앱이 브라우저에서 처음 뜰 때 1건(발주처가 Vercel 대시보드에
      접근할 수 없어, 방문자 수도 자체 관리자 화면에서 보여주려고 직접 쌓는다).
    - game_start: "시작하기" 클릭 시점. game_scores(완료된 판)와 달리 완료
      여부와 무관하게 기록되므로(중도 이탈도 포함), 이 이벤트의 COUNT(*)는
      "게임 이용 횟수"(동영상 조회수 방식 — 재플레이도 매번 카운트), game_scores의
      COUNT(*)와 비교하면 중도 이탈 비율까지 계산할 수 있다.

    player_key는 game_scores와 같은 브라우저별 익명 식별자를 그대로 재사용한다
    — 필요해지면 COUNT(DISTINCT player_key)로 순 이용자 수도 뽑을 수 있다.
    """

    __tablename__ = "game_events"
    __table_args__ = (
        CheckConstraint(
            "event_type in ('game_start', 'page_view')",
            name="ck_game_events_event_type",
        ),
        CheckConstraint(
            "game is null or game in ('chosung', 'acid_rain')",
            name="ck_game_events_game",
        ),
        CheckConstraint(
            "difficulty is null or difficulty in ('쉬움', '보통', '어려움')",
            name="ck_game_events_difficulty",
        ),
        # game_start는 어떤 게임·난이도인지 같이 남기고, page_view는 게임과
        # 무관하니 두 필드 다 비워야 한다 — schemas.py의 검증과 같은 규칙을
        # DB 레벨에도 걸어 둔다(models.Score의 ck_game_scores_game_fields와 같은 패턴).
        CheckConstraint(
            "(event_type = 'game_start' and game is not null and difficulty is not null)"
            " or (event_type = 'page_view' and game is null and difficulty is null)",
            name="ck_game_events_type_fields",
        ),
        Index("idx_game_events_type_time", "event_type", "occurred_at"),
    )

    def _new_event_id() -> uuid.UUID:  # noqa: N805 - SQLAlchemy default factory, no self
        return uuid.uuid4()

    event_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_new_event_id)
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    player_key: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    game: Mapped[str | None] = mapped_column(String(20), nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(5), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
