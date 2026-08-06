# 통일 워드게임 백엔드 (FastAPI)

프런트엔드 `src/lib/rankingApi.ts`가 기대하는 계약(API 명세서 C-1·C-2)을
그대로 구현한다. 지금은 SQLite 파일 하나로 동작하며, 운영 DB가 정해지면
`DATABASE_URL` 환경변수만 바꾸면 된다 — 위 계층(스키마·라우트·검증)은
SQLAlchemy 엔진 하나에만 의존하므로 손댈 필요가 없다.

## 실행

```bash
cd server
python -m venv .venv
.venv/Scripts/activate        # Windows. macOS/Linux는 source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env           # 필요하면 값 조정
uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/docs
- 헬스체크: http://localhost:8000/healthz

## 프런트엔드 연동

레포 루트에 `.env.local`을 두면 프런트엔드가 목업 대신 이 서버를 호출한다.

```bash
# innopost_game/.env.local
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

파일을 지우거나 `VITE_API_BASE_URL`을 빼면 다시 localStorage 목업으로
돌아간다(개발 중 서버를 안 띄워도 프런트엔드 작업이 막히지 않는다).

## 테스트

```bash
pytest tests/ -v
```

라우트·검증·랭킹 정렬·에러코드를 21건으로 검증한다. 매 테스트가 완전히
새로운 인메모리 SQLite로 시작해 서로 영향을 주지 않는다.

## 구조

```
server/
  app/
    main.py            # 라우트: POST /scores, GET /rankings, /healthz
    schemas.py          # 요청·응답 스키마 (TS 타입과 필드명 1:1 대응)
    models.py            # SQLAlchemy 테이블
    crud.py               # 저장·순위 계산·TOP5 조회
    validation.py          # 닉네임 검증 (src/lib/storage.ts와 규칙 동일)
    scoring_limits.py       # 게임·난이도별 이론상 최대 점수(422 판정 기준)
    rate_limit.py            # 요청 빈도 제한(429)
    config.py                 # 환경변수
    database.py                # SQLAlchemy 엔진·세션
  tests/
    test_scores.py       # C-1 검증
    test_rankings.py      # C-2 검증
```

## 확정이 필요한 부분

- **닉네임 금칙어 목록** — `app/validation.py`의 `BANNED_WORDS`는 샘플이다.
  운영 반영 전 발주처가 확정한 목록으로 교체해야 한다.
  - 한글 금칙어는 부분 문자열로 막는다("김관리자님"처럼 다른 글자 사이에
    끼워 회피하는 경우가 많아서). 영문 금칙어는 완전한 토큰으로 등장할
    때만 막는다 — info·notice·master·event처럼 흔한 영단어를 부분
    문자열로 걸면 noticeme·myinfo1·eventful 같은 무해한 닉네임까지
    오탐으로 막힌다(`_contains_banned_word` 참고, `tests/test_validation.py`에
    회귀 테스트 있음).
- **산성비게임 점수 상한** — 스테이지3이 무한 생존이라 진짜 "이론상
  최대 점수"가 없다. `ACID_RAIN_SCORE_CEILING`(기본 300,000)은 명백히
  조작된 값만 걸러내는 휴리스틱이다. 운영 데이터로 실제 최고 기록을
  관찰한 뒤 발주처와 협의해 조정해야 한다(초성게임은 규칙상 최댓값이
  존재해 정확히 계산했다 — `scoring_limits.py` 참고).
- **요청 빈도 제한은 단일 프로세스 인메모리** — 여러 워커·인스턴스로
  배포를 확장하면 클라이언트별 요청 기록이 프로세스마다 따로 쌓여
  제한이 헐거워진다. 그 시점에는 Redis 등 공유 저장소로 옮겨야 한다.
- **운영 DB** — SQLite는 개발용이다. PostgreSQL 등으로 옮길 때
  `DATABASE_URL`만 바꾸면 되지만, 동시 쓰기 내구성 확인은 필요하다.
