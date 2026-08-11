"""점수 저장·랭킹 조회 — 요구사항정의서 FR-RK-01~06."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Event, Score
from .schemas import EventPayload, ScorePayload


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


def create_event(db: Session, payload: EventPayload) -> Event:
    """game_scores와 달리 중복 등록 방지 키가 없다 — 재플레이도 매번 새 행으로
    쌓는 게 목적이라(조회수 방식), submission_key 같은 dedup 개념이 필요 없다.
    """
    row = Event(
        event_type=payload.event_type,
        player_key=payload.player_key,
        game=payload.game,
        difficulty=payload.difficulty,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _count_events(db: Session, event_type: str, game: str | None = None) -> int:
    stmt = select(func.count()).select_from(Event).where(Event.event_type == event_type)
    if game is not None:
        stmt = stmt.where(Event.game == game)
    return db.scalar(stmt) or 0


def get_stats(db: Session) -> dict[str, object]:
    """관리자 통계 화면용 총계 — 발주처가 Vercel 대시보드에 접근할 수 없어
    방문자 수·이용 횟수를 앱 안에서 직접 보여준다(총계만, 기간별 추이는 없음)."""
    total_page_views = _count_events(db, "page_view")
    total_game_starts = _count_events(db, "game_start")

    unique_players = (
        db.scalar(
            select(func.count(func.distinct(Event.player_key))).where(
                Event.event_type == "game_start"
            )
        )
        or 0
    )

    # 방문 대비 게임 시작 전환율 — 둘 다 game_events 안에서 같은 기간으로
    # 나오는 값이라(예전 데이터 섞일 걱정 없음) 별도 보정이 필요 없다.
    usage_rate_percent = None
    if total_page_views > 0:
        usage_rate_percent = round(total_game_starts / total_page_views * 100, 1)

    return {
        "total_page_views": total_page_views,
        "total_game_starts": total_game_starts,
        "game_starts_by_game": {
            "chosung": _count_events(db, "game_start", "chosung"),
            "acid_rain": _count_events(db, "game_start", "acid_rain"),
        },
        "unique_players": unique_players,
        "usage_rate_percent": usage_rate_percent,
    }


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
