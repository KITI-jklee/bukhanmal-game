"""Boundary tests shared by the game engine and server score validation."""

from __future__ import annotations

import pytest

from app.scoring_limits import min_acid_rain_play_time_seconds


@pytest.mark.parametrize(
    ("correct_count", "expected_seconds"),
    [
        (0, 0.0),
        (1, 0.0),
        (2, 3.2),
        (13, 38.4),
        (14, 38.4),
        (15, 40.6),
        (31, 75.8),
        (32, 75.8),
        (33, 76.6),
    ],
)
def test_min_play_time_accounts_for_immediate_stage_spawns(
    correct_count: int,
    expected_seconds: float,
) -> None:
    assert min_acid_rain_play_time_seconds(correct_count) == pytest.approx(expected_seconds)


def test_min_play_time_still_scales_for_large_counts() -> None:
    assert min_acid_rain_play_time_seconds(500) == pytest.approx(450.2)
