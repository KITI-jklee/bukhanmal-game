"""게임·난이도별 이론상 최대 점수 — API 명세서 D장 체크리스트 항목.

422(점수 범위 이상치)를 판정하는 기준값이다. 계산 근거를 코드에 남겨서
게임 규칙이 바뀌면 이 상수도 같이 다시 계산해야 한다는 걸 명확히 한다.
"""

from __future__ import annotations

import math

from .config import settings

# 초성게임 ───────────────────────────────────────── 상세기획서 3-4 / src/game/chosungConfig.ts, ChosungEngine.ts와 동일한 계산.
_CHOSUNG_RAW_MAX = 139
CHOSUNG_SCORE_MAX: dict[str, int] = {
    "쉬움": 139,  # 139 × 1.0
    "보통": 167,  # 139 × 1.2 = 166.8 → 167
    "어려움": 209,  # 139 × 1.5 = 208.5 → 209 (JS Math.round 기준)
}

# 산성비게임 ─────────────────────────────────────── 상세기획서 4-3: 스테이지3은 "무한 생존"이라 진짜 이론상 최댓값이 없다.
ACID_RAIN_SCORE_CEILING = settings.acid_rain_score_ceiling

# 스테이지 경계는 schemas.py의 결과 정합성 검증과 맞춰야 한다.
ACID_RAIN_STAGE1_MAX_CORRECT = 13  # 1단계는 정답 수가 이 값 미만이어야 한다.
ACID_RAIN_STAGE2_MAX_CORRECT = 31  # 2단계는 [STAGE1_MAX, STAGE2_MAX) 구간, 3단계는 이 값 이상.


def max_score_for(game: str, difficulty: str) -> int:
    if game == "chosung":
        return CHOSUNG_SCORE_MAX[difficulty]
    return ACID_RAIN_SCORE_CEILING

_CHOSUNG_MULTIPLIER = {"쉬움": 1.0, "보통": 1.2, "어려움": 1.5}
_ACID_BASE_SCORE = {"쉬움": 10, "보통": 12, "어려움": 15}


def _js_round(value: float) -> int:
    """양수 점수에 대한 JavaScript Math.round와 같은 반올림."""
    return math.floor(value + 0.5)


def max_chosung_score_for_correct_count(correct_count: int, difficulty: str) -> int:
    """모든 정답을 무힌트 연속 정답으로 얻었을 때의 조건부 최대 점수."""
    raw_score = sum(
        10 + (0 if combo == 1 else min(combo, 5))
        for combo in range(1, correct_count + 1)
    )
    return _js_round(raw_score * _CHOSUNG_MULTIPLIER[difficulty])


def max_acid_rain_score_for_correct_count(correct_count: int, difficulty: str) -> int:
    """주어진 일반 단어 정답 수로 얻을 수 있는 보수적인 최대 점수."""
    base = _ACID_BASE_SCORE[difficulty]
    stage1 = min(correct_count, ACID_RAIN_STAGE1_MAX_CORRECT)
    stage2 = min(
        max(correct_count - ACID_RAIN_STAGE1_MAX_CORRECT, 0),
        ACID_RAIN_STAGE2_MAX_CORRECT - ACID_RAIN_STAGE1_MAX_CORRECT,
    )
    stage3 = max(correct_count - ACID_RAIN_STAGE2_MAX_CORRECT, 0)
    return 3 * (stage1 * base + stage2 * (base + 3) + stage3 * (base + 5))


# 스테이지별 단어 생성 간격(초) - src/game/acidRainConfig.ts의 STAGES[n].spawnInterval /
# STAGE3_MIN_SPAWN(가속 하한)과 같은 값. 단어가 아직 생성되지도 않았는데 맞힐 수는
# 없으므로, 이 간격보다 빠르게는 정답을 만들어낼 수 없다 - play_time_seconds가
# correct_count에 비해 물리적으로 불가능할 만큼 짧은 제출을 걸러내는 근거가 된다.
_ACID_RAIN_STAGE1_MIN_SPAWN_INTERVAL = 3.2
_ACID_RAIN_STAGE2_MIN_SPAWN_INTERVAL = 2.2
_ACID_RAIN_STAGE3_MIN_SPAWN_INTERVAL = 0.8


def min_acid_rain_play_time_seconds(correct_count: int) -> float:
    """correct_count만큼의 정답을 내는 데 물리적으로 필요한 최소 시간(초).

    반응·입력 시간은 전혀 고려하지 않고 "단어가 생성되는 순간 바로 맞혔다"는
    가장 관대한(플레이어에게 유리한) 가정으로 계산한 절대 하한이다 - 실제
    플레이는 항상 이보다 오래 걸리므로, 정상적인 플레이를 오탐으로 거절할
    일은 없다. 스테이지 경계는 위 ACID_RAIN_STAGE1_MAX_CORRECT/
    ACID_RAIN_STAGE2_MAX_CORRECT와 맞춰야 한다."""
    stage1 = min(correct_count, ACID_RAIN_STAGE1_MAX_CORRECT)
    stage2 = min(
        max(correct_count - ACID_RAIN_STAGE1_MAX_CORRECT, 0),
        ACID_RAIN_STAGE2_MAX_CORRECT - ACID_RAIN_STAGE1_MAX_CORRECT,
    )
    stage3 = max(correct_count - ACID_RAIN_STAGE2_MAX_CORRECT, 0)
    # The engine spawns the first word immediately at game start and after each
    # stage transition. Only subsequent words require a spawn interval. Stage
    # banners are intentionally omitted to keep this a conservative lower bound.
    return (
        max(stage1 - 1, 0) * _ACID_RAIN_STAGE1_MIN_SPAWN_INTERVAL
        + max(stage2 - 1, 0) * _ACID_RAIN_STAGE2_MIN_SPAWN_INTERVAL
        + max(stage3 - 1, 0) * _ACID_RAIN_STAGE3_MIN_SPAWN_INTERVAL
    )
