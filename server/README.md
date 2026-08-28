# 통일 워드게임 백엔드 (FastAPI)

프런트엔드 `src/lib/rankingApi.ts`가 기대하는 계약(API 명세서 C-1·C-2·
06_API_DB매핑)을 그대로 구현한다. 운영 DB는 Supabase(Postgres)로 확정됐다
— `DATABASE_URL`은 필수 환경변수이고 sqlite 파일 폴백은 없다(Vercel 등
서버리스는 파일시스템이 요청마다 초기화/읽기전용이라 sqlite를 운영 DB로
못 쓰기 때문). 위 계층(스키마·라우트·검증)은 SQLAlchemy 엔진 하나에만
의존하므로 `DATABASE_URL` 값이 바뀌어도 손댈 필요가 없다.

## 실행

```bash
cd server
python -m venv .venv
.venv/Scripts/activate        # Windows. macOS/Linux는 source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env
# DATABASE_URL, ADMIN_PASSWORD, PLAYER_TOKEN_SECRET을 채운다.
# PLAYER_TOKEN_SECRET은 관리자 비밀번호와 다른 32자 이상의 무작위 값이어야 한다.
# 필수 값이 없으면 기동 시 바로 에러가 난다 — app/config.py 참고.
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

기본 테스트는 빠른 인메모리 SQLite 단위 테스트다. 실제 PostgreSQL/Supabase
연동까지 확인하려면 스키마가 적용된 전용 테스트 DB의 직접 연결 또는 세션 풀러
URL을 `TEST_DATABASE_URL`에 넣고 통합 테스트를 실행한다.

```bash
TEST_DATABASE_URL=postgresql+psycopg://... pytest tests/integration -v
```

`TEST_DATABASE_URL`이 없으면 통합 테스트는 자동으로 건너뛴다. 테스트 중 생성한
점수·이벤트·요청 제한 데이터는 테스트 종료 시 트랜잭션 롤백으로 제거된다.


라우트·검증·랭킹 정렬·최근 기록·에러코드를 검증한다. 매 테스트가 완전히
새로운 인메모리 SQLite로 시작해 서로 영향을 주지 않는다 — 이건 운영 DB와
무관한 테스트 전용 더블이다(실제 쿼리는 Supabase에 붙지 않고 여기서
끝난다). `tests/conftest.py`가 `DATABASE_URL`이 없어도 임포트가 되도록
더미 값을 채워 두므로 `.env` 없이도 테스트는 돈다.

## 구조

```
server/
  app/
    main.py            # 라우트: POST /api/v1/players/session, POST /api/v1/scores,
                        #   GET /api/v1/rankings, POST /api/v1/events,
                        #   GET /api/v1/admin/stats, GET /api/v1/scores/recent, /healthz
    schemas.py          # 요청·응답 스키마 (TS 타입과 필드명 1:1 대응)
    models.py           # SQLAlchemy 테이블 (game_scores, game_events, request_limits)
    crud.py             # 저장·순위 계산·TOP5·내 최근 기록 조회
    db_utils.py         # 낙관적 삽입 후 IntegrityError 복구 공용 헬퍼(crud·rate_limit 공용)
    validation.py       # 닉네임 검증 (src/lib/storage.ts와 규칙 동일)
    scoring_limits.py   # 게임·난이도별 이론상 최대 점수(422 판정 기준)
    rate_limit.py       # DB 공유 요청 빈도 제한(429) 및 오래된 버킷 정리
    security.py         # 서명된 익명 플레이어 세션 토큰 발급·검증(X-Player-Token)
    config.py           # 환경변수 (DB·관리자·플레이어 서명 키 필수)
    database.py         # SQLAlchemy 엔진·세션
  supabase_schema.sql       # 새 PostgreSQL 배포용 전체 스키마
  supabase_hardening.sql    # 기존(pre-request_limits) Supabase DB를 최신 스키마로 보강하는 증분 스크립트
  requirements.txt          # 운영 의존성
  requirements-dev.txt      # 로컬 개발·테스트·보안 감사 도구(requirements.txt 포함)
  tests/
    conftest.py             # 인메모리 SQLite 테스트 DB·client/authorized_client 픽스처
    test_scores.py          # C-1 검증
    test_rankings.py        # C-2 검증
    test_recent_records.py  # 내 최근 기록(player_key 기준) 검증
    test_events.py          # 방문자/이용 지표 이벤트(page_view·game_start) 검증
    test_admin_stats.py     # 관리자 통계 화면(GET /api/v1/admin/stats) 검증
    test_security.py        # 플레이어 세션 토큰 서명·만료 검증
    test_validation.py      # 닉네임 금칙어 검증
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
- **요청 빈도 제한 저장소** — 모든 워커·서버리스 인스턴스가 Supabase의
  `request_limits` 테이블을 공유한다. `RATE_LIMIT_RETENTION_SECONDS`
  (기본 86,400초)보다 오래된 버킷은 약 1%의 제한 대상 요청에서 정리된다.
