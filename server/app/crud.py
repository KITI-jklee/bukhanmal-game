"""점수 저장·랭킹 조회 — 요구사항정의서 FR-RK-01~06."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from .db_utils import insert_or_recover
from .models import Event, Score
from .schemas import EventPayload, ScorePayload


def create_score(db: Session, payload: ScorePayload, player_key: uuid.UUID) -> Score:
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
        "player_key": player_key,
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
            correct_count=payload.correct_count,
            stage_reached=payload.stage_reached,
            time_stop_uses=payload.time_stop_uses,
            time_stop_clears=payload.time_stop_clears,
            play_time_seconds=payload.play_time_seconds,
        )
    return insert_or_recover(
        db,
        row,
        lambda: db.scalar(select(Score).where(Score.submission_key == payload.submission_key)),
    )


def rank_of(db: Session, row: Score) -> tuple[int, int]:
    """방금 저장한(또는 재사용된) 기록의 (순위, 전체 인원)을 계산한다."""
    same_board = (Score.game_type == row.game_type, Score.difficulty == row.difficulty)
    ahead = or_(
        Score.score > row.score,
        and_(Score.score == row.score, Score.played_at < row.played_at),
        and_(
            Score.score == row.score,
            Score.played_at == row.played_at,
            Score.score_id < row.score_id,
        ),
    )
    rank = (db.scalar(select(func.count()).select_from(Score).where(*same_board, ahead)) or 0) + 1
    total = db.scalar(select(func.count()).select_from(Score).where(*same_board)) or 0
    return rank, total


def top5(db: Session, game: str, difficulty: str) -> list[Score]:
    stmt = (
        select(Score)
        .where(Score.game_type == game, Score.difficulty == difficulty)
        .order_by(Score.score.desc(), Score.played_at.asc(), Score.score_id.asc())
        .limit(5)
    )
    return list(db.scalars(stmt))


def create_event(db: Session, payload: EventPayload, player_key: uuid.UUID) -> Event:
    """game_scores와 달리 중복 등록 방지 키가 없다 — 재플레이도 매번 새 행으로
    쌓는 게 목적이라(조회수 방식), submission_key 같은 dedup 개념이 필요 없다.
    """
    row = Event(
        event_type=payload.event_type,
        player_key=player_key,
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

    unique_visitors = (
        db.scalar(
            select(func.count(func.distinct(Event.player_key))).where(
                Event.event_type == "page_view"
            )
        )
        or 0
    )

    unique_players = (
        db.scalar(
            select(func.count(func.distinct(Event.player_key))).where(
                Event.event_type == "game_start"
            )
        )
        or 0
    )

    # 방문(페이지뷰) 대비 게임이 시작된 비율 — 관리자 화면의 "방문자 수" 카드가
    # 고유 방문자가 아니라 방문 횟수 총계(total_page_views)를 보여주도록 바뀌면서,
    # 이용률도 같은 기준(총계 대 총계)으로 계산해야 두 수치가 서로 맞아 들어간다.
    # 한 번의 방문에서 게임을 여러 번 시작하면 100%를 넘을 수 있다.
    usage_rate_percent = None
    if total_page_views > 0:
        usage_rate_percent = round(total_game_starts / total_page_views * 100, 1)

    average_game_starts_per_player = None
    if unique_players > 0:
        average_game_starts_per_player = round(total_game_starts / unique_players, 1)

    return {
        "total_page_views": total_page_views,
        "total_game_starts": total_game_starts,
        "unique_visitors": unique_visitors,
        "game_starts_by_game": {
            "chosung": _count_events(db, "game_start", "chosung"),
            "acid_rain": _count_events(db, "game_start", "acid_rain"),
        },
        "unique_players": unique_players,
        "usage_rate_percent": usage_rate_percent,
        "average_game_starts_per_player": average_game_starts_per_player,
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
