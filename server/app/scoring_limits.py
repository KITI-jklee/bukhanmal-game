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
