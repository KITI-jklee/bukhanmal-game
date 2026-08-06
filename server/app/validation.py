"""닉네임 검증 — 프런트엔드 `src/lib/storage.ts`의 규칙을 그대로 미러링한다.

클라이언트가 먼저 걸러내지만(요구사항정의서 FR-RK-05 "서버가 최종 검증"),
서버를 직접 호출하는 경로에서도 같은 기준이 적용되어야 하므로 규칙을
한 곳(여기)에만 두지 않고 두 언어에 각각 두되 반드시 같은 결과를 내도록
정규식·기준을 동일하게 유지한다.
"""

from __future__ import annotations

import re
import unicodedata

# 한글 음절·영문·숫자·공백·밑줄·하이픈만 허용한다. 화이트리스트 방식이라
# `<`, `>`, `/`, `;` 같은 HTML 태그·스크립트 문자열은 애초에 통과하지 못한다
# (API 명세서 C-1 "HTML 태그·스크립트 문자열 거부"를 별도 필터 없이 만족).
_ALLOWED_PATTERN = re.compile(r"^[가-힣a-zA-Z0-9 _-]+$")

# 샘플 금칙어 목록. 운영 반영 전 발주처가 확정한 목록으로 교체해야 한다.
BANNED_WORDS: frozenset[str] = frozenset({
    # --- 1. 운영자 및 시스템 사칭 ---
    "운영자", "관리자", "매니저", "마스터", "어드민", "시스템", "고객센터", "도우미", "대표",
    "공지", "안내", "이벤트", "욲영자", "관릮자", "운영진", "관리진",
    "admin", "administrator", "sysop", "master", "manager", "root", "operator",
    "support", "official", "helpdesk", "info", "notice", "event",

    # --- 2. 기본 욕설 및 비속어 ---
    "시발", "씨발", "씨뱔", "씝빨", "씹빨", "싮발", "십팔", "십8",
    "병신", "벼엉신", "뼝신", "병싞", "뼝싞", "ㅂㅅ", "ㅅㅂ", "ㅆㅂ",
    "개새끼", "존나", "좆", "좆같", "씹같", "좆까", "좆나", "좆밥", "찌질이",
    "미친", "미친놈", "미친년", "ㅈㄴ", "ㅈ까", "ㄷㅊ", "ㄲㅈ", "ㅈㄹ",

    # --- 3. 혐오, 비하 표현 (장애/성별/지역/집단) ---
    "애자", "장애우", "장애인", "지적장애", "뇌절", "멍청이", "저능아", "정신병자",
    "혜지", "김치녀", "된장녀", "한남", "한남충", "틀딱", "메갈", "페미", "맘충",
    "홍어", "과메기", "통구이", "헬조선", "좌빨", "수꼴",

    # --- 4. 음란 및 성적 표현 ---
    "자지", "보지", "자위", "야동", "섹스", "sex", "자지보지", "펠라", "오르가즘",
    "원나잇", "조건만남", "성매매", "조건", "출장안마",

    # --- 5. 시스템예약어 및 오류 유발 ---
    "null", "undefined", "nan", "none", "script", "select", "drop", "delete", "insert"
})

# 한글 금칙어는 부분 문자열로, 영문 금칙어는 완전한 토큰으로 등장할 때만 막는다.
#
# 한국어는 띄어쓰기 없이 욕설을 다른 글자 사이에 끼워 회피하는 경우가 많아
# ("김관리자님", "진짜씨발") 부분 문자열 검사가 필요하다. 반면 info·notice·
# master·event 같은 흔한 영단어는 다른 단어의 일부로 자주 등장해서
# (noticeme, myinfo1, eventful) 부분 문자열로 걸면 무해한 닉네임까지
# 오탐으로 막는다. 영문·숫자가 끊기지 않고 이어진 하나의 토큰으로 등장할
# 때만 막으면 "info"는 잡고 "myinfo1"은 통과시킬 수 있다.
_ASCII_BANNED = frozenset(word for word in BANNED_WORDS if word.isascii())
_OTHER_BANNED = frozenset(word for word in BANNED_WORDS if not word.isascii())
_LATIN_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def _contains_banned_word(lowered: str) -> bool:
    if any(word in lowered for word in _OTHER_BANNED):
        return True
    tokens = _LATIN_TOKEN_PATTERN.findall(lowered)
    return any(token in _ASCII_BANNED for token in tokens)


def normalize_nickname(value: str) -> str:
    """NFKC 정규화 후 앞뒤 공백 제거, 연속 공백을 하나로 — storage.ts와 동일."""
    normalized = unicodedata.normalize("NFKC", value).strip()
    return re.sub(r"\s+", " ", normalized)


def validate_nickname(value: str) -> str | None:
    """유효하면 None, 그렇지 않으면 사용자에게 보여줄 오류 메시지를 반환한다."""
    normalized = normalize_nickname(value)
    if len(normalized) < 1:
        return "닉네임을 입력해 주세요."
    if len(normalized) > 10:
        return "닉네임은 10자 이내로 입력해 주세요."
    if not _ALLOWED_PATTERN.match(normalized):
        return "한글, 영문, 숫자, 공백, 밑줄, 하이픈만 사용할 수 있어요."
    lowered = normalized.lower()
    if _contains_banned_word(lowered):
        return "사용할 수 없는 닉네임입니다."
    return None
