"""점수 저장·랭킹 조회 — 요구사항정의서 FR-RK-01~06."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Score
from .schemas import ScorePayload


def create_score(db: Session, payload: ScorePayload) -> Score:
    """submission_key가 이미 존재하면 재삽입 없이 기존 기록을 그대로 반환한다
    (클라이언트 재시도로 같은 결과가 중복 등록되는 것을 막는다 — DB 설계서
    04_인덱스_제약 uq_game_scores_submission_key).
    """
    existing = db.scalar(
        select(Score).where(Score.submission_key == payload.submission_key)
    )
    if existing is not None:
        return existing

    common = {
        "player_key": payload.player_key,
        "submission_key": payload.submission_key,
        "nickname": payload.nickname,
        "game_type": payload.game,
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
            correct_count=0,
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
        .where(Score.game_type == game, Score.difficulty == difficulty)
        .order_by(Score.score.desc(), Score.played_at.asc())
    )
    return list(db.scalars(stmt))


def rank_of(db: Session, row: Score) -> tuple[int, int]:
    """방금 저장한(또는 재사용된) 기록의 (순위, 전체 인원)을 계산한다."""
    board = _leaderboard(db, row.game_type, row.difficulty)
    rank = next(i for i, entry in enumerate(board, start=1) if entry.score_id == row.score_id)
    return rank, len(board)


def top5(db: Session, game: str, difficulty: str) -> list[Score]:
    return _leaderboard(db, game, difficulty)[:5]


def recent_records(
    db: Session, player_key: uuid.UUID, game: str, difficulty: str, limit: int
) -> list[Score]:
    """API 명세서 06_API_DB매핑: "내 최근 기록"은 nickname이 아닌 player_key
    기준으로 조회한다(닉네임 중복 시에도 내 기록만 구분해서 봄).
    """
    stmt = (
        select(Score)
        .where(
            Score.player_key == player_key,
            Score.game_type == game,
            Score.difficulty == difficulty,
        )
        .order_by(Score.played_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))
