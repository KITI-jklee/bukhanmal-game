"""닉네임 검증 — 한글/영문 금칙어 매칭 방식이 다르다는 걸 회귀 방지로 고정한다.

한글 금칙어는 부분 문자열로 막는다("김관리자님"처럼 다른 글자 사이에 끼워
회피하는 경우가 많아서). 영문 금칙어는 완전한 토큰으로 등장할 때만 막는다
(info·notice·master·event 같은 흔한 영단어가 noticeme·myinfo1·eventful
처럼 다른 단어의 일부로 자주 쓰여서, 부분 문자열로 걸면 오탐이 난다).
"""

from __future__ import annotations

import pytest

from app.validation import validate_nickname


@pytest.mark.parametrize(
    "nickname",
    ["noticeme", "myinfo1", "eventful", "masterchef", "uproot", "supportive"],
)
def test_ascii_banned_word_as_substring_of_innocent_word_is_allowed(nickname):
    assert validate_nickname(nickname) is None


@pytest.mark.parametrize("nickname", ["admin", "Admin", "info", "관리자"])
def test_banned_word_alone_is_still_blocked(nickname):
    assert validate_nickname(nickname) == "사용할 수 없는 닉네임입니다."


@pytest.mark.parametrize("nickname", ["김관리자님", "진짜씨발"])
def test_korean_banned_word_embedded_in_nickname_is_still_blocked(nickname):
    """한글은 구분자 없이 다른 글자 사이에 끼워도(부분 문자열) 막아야 한다."""
    assert validate_nickname(nickname) == "사용할 수 없는 닉네임입니다."


@pytest.mark.parametrize("nickname", ["my-info", "김admin"])
def test_ascii_banned_word_separated_by_boundary_is_blocked(nickname):
    """구분자(하이픈·공백·한글 경계)로 분리돼 독립된 토큰으로 등장하면 막는다."""
    assert validate_nickname(nickname) == "사용할 수 없는 닉네임입니다."
