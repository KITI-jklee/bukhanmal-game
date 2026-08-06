"""게임·난이도별 이론상 최대 점수 — API 명세서 D장 체크리스트 항목.

422(점수 범위 이상치)를 판정하는 기준값이다. 계산 근거를 코드에 남겨서
게임 규칙이 바뀌면 이 상수도 같이 다시 계산해야 한다는 걸 명확히 한다.
"""

from __future__ import annotations

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


def max_score_for(game: str, difficulty: str) -> int:
    if game == "chosung":
        return CHOSUNG_SCORE_MAX[difficulty]
    return ACID_RAIN_SCORE_CEILING
