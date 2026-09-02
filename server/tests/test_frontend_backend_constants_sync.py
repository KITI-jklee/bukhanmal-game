"""프런트엔드(src/game/*.ts)와 백엔드(scoring_limits.py)가 각자 하드코딩해서
들고 있는 밸런스 상수가 실제로 같은 값인지 자동으로 대조한다.

코드리뷰로 발견된 문제: scoring_limits.py는 acidRainConfig.ts/chosungConfig.ts와
"값을 맞춰야 한다"는 주석만 있을 뿐 실제 연결은 없어서, 한쪽만 밸런스를
조정하면 정상적인 점수가 서버에서 조용히 거절(또는 반대로 과도하게 허용)될
수 있었다. 공유 설정 파일 하나로 합치는 대신(두 런타임 다 그 파일을 읽게
바꾸는 건 이번 범위를 넘는 더 큰 리팩터다), 값이 갈라지면 이 테스트가
CI에서 바로 실패해 조용한 드리프트를 막는다 - 둘 중 하나를 고치면 반드시
이 테스트도 확인하게 된다.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

# server/tests/이 파일 -> 저장소 루트로 두 단계 올라간다.
REPO_ROOT = Path(__file__).resolve().parents[2]
ACID_RAIN_CONFIG_TS = REPO_ROOT / "src" / "game" / "acidRainConfig.ts"
CHOSUNG_CONFIG_TS = REPO_ROOT / "src" / "game" / "chosungConfig.ts"


def _read(path: Path) -> str:
    if not path.exists():
        pytest.skip(f"{path}를 찾을 수 없어 프런트·백엔드 상수 대조를 건너뜁니다.")
    return path.read_text(encoding="utf-8")


def test_acid_rain_stage_boundaries_match_frontend():
    from app.scoring_limits import ACID_RAIN_STAGE1_MAX_CORRECT, ACID_RAIN_STAGE2_MAX_CORRECT

    source = _read(ACID_RAIN_CONFIG_TS)
    stage1_target = int(re.search(r"stage:\s*1,\s*target:\s*(\d+)", source, re.DOTALL).group(1))
    stage2_target = int(re.search(r"stage:\s*2,\s*target:\s*(\d+)", source, re.DOTALL).group(1))

    assert ACID_RAIN_STAGE1_MAX_CORRECT == stage1_target, (
        "acidRainConfig.ts STAGES[0].target이 바뀌었는데 scoring_limits.py의 "
        "ACID_RAIN_STAGE1_MAX_CORRECT가 안 맞춰졌습니다."
    )
    assert ACID_RAIN_STAGE2_MAX_CORRECT == stage1_target + stage2_target, (
        "acidRainConfig.ts STAGES[1].target(또는 STAGES[0].target)이 바뀌었는데 "
        "scoring_limits.py의 ACID_RAIN_STAGE2_MAX_CORRECT가 안 맞춰졌습니다."
    )


def test_acid_rain_base_scores_match_frontend():
    from app.scoring_limits import _ACID_BASE_SCORE

    source = _read(ACID_RAIN_CONFIG_TS)
    block = re.search(r"BASE_SCORE[^{]*\{(.*?)\}", source, re.DOTALL).group(1)
    for difficulty in ("쉬움", "보통", "어려움"):
        value = int(re.search(rf"{difficulty}\s*:\s*(\d+)", block).group(1))
        assert _ACID_BASE_SCORE[difficulty] == value, (
            f"acidRainConfig.ts BASE_SCORE.{difficulty}({value})와 "
            f"scoring_limits.py _ACID_BASE_SCORE[{difficulty!r}]"
            f"({_ACID_BASE_SCORE[difficulty]})가 다릅니다."
        )


def test_acid_rain_stage3_min_spawn_matches_frontend():
    from app.scoring_limits import _ACID_RAIN_STAGE3_MIN_SPAWN_INTERVAL

    source = _read(ACID_RAIN_CONFIG_TS)
    value = float(re.search(r"STAGE3_MIN_SPAWN\s*=\s*([\d.]+)", source).group(1))
    assert _ACID_RAIN_STAGE3_MIN_SPAWN_INTERVAL == value


def test_chosung_difficulty_multiplier_matches_frontend():
    from app.scoring_limits import _CHOSUNG_MULTIPLIER

    source = _read(CHOSUNG_CONFIG_TS)
    block = re.search(r"DIFFICULTY_MULTIPLIER[^{]*\{(.*?)\}", source, re.DOTALL).group(1)
    for difficulty in ("쉬움", "보통", "어려움"):
        value = float(re.search(rf"{difficulty}\s*:\s*([\d.]+)", block).group(1))
        assert _CHOSUNG_MULTIPLIER[difficulty] == value, (
            f"chosungConfig.ts DIFFICULTY_MULTIPLIER.{difficulty}({value})와 "
            f"scoring_limits.py _CHOSUNG_MULTIPLIER[{difficulty!r}]"
            f"({_CHOSUNG_MULTIPLIER[difficulty]})가 다릅니다."
        )
