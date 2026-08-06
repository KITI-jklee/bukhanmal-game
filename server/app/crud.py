"""점수 저장·랭킹 조회 — 요구사항정의서 FR-RK-01~06."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Score
from .schemas import ScorePayload


def create_score(db: Session, payload: ScorePayload) -> Score:
    common = {
        "nickname": payload.nickname,
        "game": payload.game,
        "difficulty": payload.difficulty,
        "score": payload.score,
        "max_combo": payload.max_combo,
    }
    if payload.game == "chosung":
        row = Score(
            **common,
            correct_count=payload.correct_count,
            no_hint_correct_count=payload.no_hint_correct_count,
        )
    else:
        row = Score(
            **common,
            stage_reached=payload.stage_reached,
            time_stop_uses=payload.time_stop_uses,
            time_stop_clears=payload.time_stop_clears,
            play_time_seconds=payload.play_time_seconds,
        )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _leaderboard(db: Session, game: str, difficulty: str) -> list[Score]:
    """score 내림차순, 동점 시 played_at 오름차순(FR-RK-06: 먼저 달성한 기록 우선)."""
    stmt = (
        select(Score)
        .where(Score.game == game, Score.difficulty == difficulty)
        .order_by(Score.score.desc(), Score.played_at.asc())
    )
    return list(db.scalars(stmt))


def rank_of(db: Session, row: Score) -> tuple[int, int]:
    """방금 저장한 기록의 (순위, 전체 인원)을 계산한다."""
    board = _leaderboard(db, row.game, row.difficulty)
    rank = next(i for i, entry in enumerate(board, start=1) if entry.id == row.id)
    return rank, len(board)


def top5(db: Session, game: str, difficulty: str) -> list[Score]:
    return _leaderboard(db, game, difficulty)[:5]
