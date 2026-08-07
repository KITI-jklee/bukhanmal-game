"""SQLAlchemy 엔진·세션.

운영 DB는 Supabase(Postgres) — `DATABASE_URL`로만 지정한다(config.py가
필수로 요구함, sqlite 파일 폴백 없음. 이유: Vercel 등 서버리스는 파일시스템이
요청마다 초기화/읽기전용이라 sqlite 파일이 운영 DB로 못 씀). sqlite는 오직
테스트(tests/conftest.py)에서 인메모리로만 쓰인다. 이 모듈 아래 코드
(models·crud·main)는 DATABASE_URL이 바뀌어도 손댈 필요가 없다.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# SQLite(테스트 전용)는 기본적으로 하나의 스레드에서만 커넥션을 재사용할 수
# 있다. FastAPI는 요청마다 스레드풀을 쓸 수 있으므로 check_same_thread를
# 끈다. (Postgres에는 이 커넥션 인자가 없어 무시된다)
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
