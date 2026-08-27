"""게임·난이도별 이론상 최대 점수 — API 명세서 D장 체크리스트 항목.

422(점수 범위 이상치)를 판정하는 기준값이다. 계산 근거를 코드에 남겨서
게임 규칙이 바뀌면 이 상수도 같이 다시 계산해야 한다는 걸 명확히 한다.
"""

from __future__ import annotations

import math

from .config import settings

# ── 초성게임 ─────────────────────────────────────────
#
# 상세기획서 3-4 / src/game/chosungConfig.ts, ChosungEngine.ts와 동일한 계산.
# 한 판 10문제를 힌트 없이·오답 없이 전부 맞히는 것이 유일한 최댓값 경로다
# (힌트를 쓰면 기본점수가 10 → 5 → 2로 낮아지므로 항상 손해).
#
# 문제별 기본점수 10점 + 콤보 보너스(1연속 0, 2연속 +2, 3연속 +3, 4연속 +4,
# 5연속 이상 +5로 상한)를 10문제 누적하면:
#   10 + 12 + 13 + 14 + 15×6 = 139  (raw score, 배수 적용 전)
#
# 최종 점수는 raw × 난이도 배수를 반올림한다. JS `Math.round`는 .5를 양의
# 방향으로 올리므로(반대로 파이썬 기본 round는 은행원 라운딩이라 .5에서
# 짝수로 내림) 여기서는 실제 클라이언트 계산 결과를 그대로 상수로 박아
# 언어 차이로 상한이 어긋나는 일이 없게 한다.
_CHOSUNG_RAW_MAX = 139
CHOSUNG_SCORE_MAX: dict[str, int] = {
    "쉬움": 139,  # 139 × 1.0
    "보통": 167,  # 139 × 1.2 = 166.8 → 167
    "어려움": 209,  # 139 × 1.5 = 208.5 → 209 (JS Math.round 기준)
}

# ── 산성비게임 ───────────────────────────────────────
#
# 상세기획서 4-3: 스테이지3은 "무한 생존"이라 진짜 이론상 최댓값이 없다.
# 그래서 난이도별로 계산된 상한이 아니라, 명백히 조작된 값만 걸러내는
# 휴리스틱 상한을 대신 둔다(운영 데이터로 실제 최고 기록을 관찰한 뒤
# 발주처와 협의해 조정 필요 — API 명세서 D장 미확정 항목).
ACID_RAIN_SCORE_CEILING = settings.acid_rain_score_ceiling

# 스테이지 경계(정답 수 기준) — schemas.py의 stage_reached ↔ correct_count
# 정합성 검증(AcidRainScorePayload._check_result_consistency)과 아래
# max_acid_rain_score_for_correct_count가 반드시 같은 값을 써야 한다. 여기
# 한 곳에서만 정의하고 schemas.py는 이 상수를 그대로 가져다 쓴다.
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
