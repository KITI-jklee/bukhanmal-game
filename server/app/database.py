"""SQLAlchemy 엔진·세션.

지금은 SQLite 파일로 시작한다. 운영 DB가 정해지면 `DATABASE_URL` 환경변수만
바꾸면 되고, 이 모듈 아래 코드(models·crud·main)는 손댈 필요가 없다.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# SQLite는 기본적으로 하나의 스레드에서만 커넥션을 재사용할 수 있다.
# FastAPI는 요청마다 스레드풀을 쓸 수 있으므로 check_same_thread를 끈다.
# (PostgreSQL 등 실제 서버 DB로 바꾸면 이 커넥션 인자는 무시된다)
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
