"""공용 DB 헬퍼.

crud.create_score와 rate_limit._enforce가 각각 독립적으로 구현하던 "먼저
조회 없이 낙관적으로 삽입을 시도하고, 동시 요청과 경합해 유니크 제약을
위반하면(IntegrityError) 롤백한 뒤 이미 커밋에 성공한 행을 다시 조회해
그걸 대신 쓴다" 패턴을 한 곳으로 모은다. 매 요청마다 먼저 SELECT로 존재를
확인한 뒤에만 INSERT하는 방식 대신 이 낙관적 삽입 방식을 쓰는 이유는,
동시 요청 경합이 흔치 않은 정상 경로에서 조회를 하나 아끼기 위해서다.
"""

from __future__ import annotations

from typing import Callable, TypeVar

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

T = TypeVar("T")


def insert_or_recover(
    db: Session,
    row: T,
    lookup_existing: Callable[[], T | None],
    *,
    refresh: bool = True,
) -> T:
    """row를 낙관적으로 커밋한다.

    동시 요청과 경합해 유니크 제약을 위반하면(IntegrityError) 롤백한 뒤
    lookup_existing()으로 먼저 커밋에 성공한 행을 다시 찾아 반환한다.
    lookup_existing()이 여전히 None이면(유니크 제약이 아닌 다른 이유로 실패한
    것이므로) 원래 예외를 그대로 다시 던진다.

    반환값이 인자로 받은 row와 동일한 객체인지(`is`)로 "경합 없이 새로
    삽입됐는지" 여부를 호출부에서 구분할 수 있다 — 경합이 있었다면
    lookup_existing()이 찾아준 다른 객체가 반환된다.

    refresh=True(기본값)이면 성공적으로 삽입했을 때 db.refresh(row)를 호출한
    뒤 반환한다 — 서버/DB 쪽에서 채운 필드를 호출부가 바로 읽어야 할 때 쓴다.
    회복 경로(lookup_existing이 찾아준 기존 행)는 이미 조회로 얻은 값이라
    refresh가 필요 없다.
    """
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = lookup_existing()
        if existing is None:
            raise
        return existing
    if refresh:
        db.refresh(row)
    return row
