"""점수 테이블 — API 명세서 C-1 요청 본문 필드를 그대로 옮긴다.

게임별 전용 필드(초성: correct_count·no_hint_correct_count / 산성비:
stage_reached·time_stop_uses·time_stop_clears·play_time_seconds)는 서로
쓰지 않는 쪽에서는 NULL로 둔다. 두 게임을 한 테이블에 두는 이유는 랭킹
조회가 어차피 game·difficulty로 필터링해서 쓰기 때문— 굳이 테이블을
나눠서 UNION으로 다시 합칠 이유가 없다.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _new_id() -> str:
    # 프런트엔드 목업의 `score_<timestamp36>` 대신 충돌 걱정이 없는 uuid를 쓴다.
    return f"score_{uuid.uuid4().hex[:12]}"


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    nickname: Mapped[str] = mapped_column(String(10), nullable=False)
    game: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    difficulty: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    max_combo: Mapped[int] = mapped_column(Integer, nullable=False)

    # 초성게임 전용
    correct_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_hint_correct_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 산성비게임 전용
    stage_reached: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_stop_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_stop_clears: Mapped[int | None] = mapped_column(Integer, nullable=True)
    play_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
