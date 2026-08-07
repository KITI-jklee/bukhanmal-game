# 북한말 학습 게임

통일부 공공데이터를 활용해 북한말을 쉽고 재미있게 학습할 수 있도록 제작한 웹 게임입니다.

> 이 저장소는 회사 업무 목적으로 개발된 프로젝트입니다. 코드와 관련 산출물의 사용·배포 및 권리 귀속은 회사 정책과 계약 조건을 따릅니다.

## 주요 기능

- 남북한말 산성비 게임
- 북한말 초성 퀴즈
- 쉬움·보통·어려움 난이도 제공
- 점수 저장 및 게임별 랭킹 조회
- PC와 모바일 환경을 지원하는 반응형 UI
- 한글 IME 입력, 화면 전환 및 모바일 키보드 대응

## 기술 구성

| 구분 | 기술 |
|---|---|
| 프런트엔드 | React 19, TypeScript, Vite |
| 백엔드 | FastAPI, SQLAlchemy |
| 데이터베이스 | Supabase (PostgreSQL) |
| 테스트 | Vitest, pytest |
| 코드 검사 | Oxlint |
| 배포 | Vercel (Services — 프런트·백엔드 한 프로젝트에 배포) |

## 사전 요구사항

- Node.js 22 이상 25 미만
- npm
- Python 3 및 pip (백엔드 실행 시)

## 프런트엔드 실행

```bash
npm install
npm run dev
```

기본 개발 서버는 `http://localhost:5173`에서 실행됩니다.

백엔드 없이 실행하면 점수와 랭킹은 브라우저의 `localStorage`에 저장됩니다.

## 백엔드 실행

```bash
cd server
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API 문서: `http://localhost:8000/docs`
- 헬스 체크: `http://localhost:8000/healthz`
- 자세한 설정: [백엔드 README](server/README.md)

프런트엔드를 로컬 백엔드와 연결하려면 프로젝트 루트에 `.env.local`을 생성합니다(로컬 개발 전용 — 배포판은 아래 "배포" 참고).

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## 배포 (Vercel)

프런트엔드와 백엔드를 **하나의 Vercel 프로젝트**에 [Services](https://vercel.com/docs/services)로 함께 배포한다 — 저장소 루트의 [`vercel.json`](vercel.json)이 이 구성을 정의한다.

```json
{
  "services": {
    "frontend": { "root": "./", "framework": "vite" },
    "backend": { "root": "server/", "entrypoint": "app.main:app" }
  },
  "rewrites": [
    { "source": "/healthz", "destination": { "service": "backend" } },
    { "source": "/api/(.*)", "destination": { "service": "backend" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ]
}
```

- `/api/*`, `/healthz`는 백엔드(FastAPI) 서비스로, 나머지는 프런트엔드(React) 서비스로 라우팅된다.
- 같은 도메인에서 서빙되므로 프런트엔드는 `VITE_API_BASE_URL`을 **설정하지 않는다** — 기본값(`/api/v1`, 상대 경로)이 그대로 같은 도메인의 백엔드 서비스로 연결된다.
- Vercel 프로젝트 환경변수(Production)에 아래 값을 등록해야 한다 (백엔드 서비스가 읽는 값 — `server/.env.example` 참고):
  - `DATABASE_URL` — Supabase 연결 문자열 (Connection Pooler, 포트 6543 권장)
  - `CORS_ORIGINS` — 로컬 개발 도메인만 있어도 되지만(운영은 동일 도메인이라 CORS 자체가 필요 없음), 그대로 둬도 무방
  - `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS`, `ACID_RAIN_SCORE_CEILING`
- GitHub `main`에 푸시하면 두 서비스가 함께 자동으로 다시 빌드·배포된다.
- 요청 빈도 제한(`server/app/rate_limit.py`)은 프로세스 메모리 기반이다. Vercel의 Fluid compute는 인스턴스를 최대한 재사용해서 대부분 상황에서 잘 동작하지만, 트래픽이 급증하면 여러 인스턴스로 나뉠 수 있어 100% 보장되는 방식은 아니다 — 트래픽이 늘어나면 Redis 등 공유 저장소로 옮기는 것을 검토한다.

## 주요 명령어

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 프런트엔드 개발 서버 실행 |
| `npm run build` | 타입 검사 및 프로덕션 빌드 |
| `npm run preview` | 프로덕션 빌드 미리보기 |
| `npm run lint` | 프런트엔드 코드 검사 |
| `npm test` | 프런트엔드 단위 테스트 |
| `npm run check:engine` | 산성비 게임 엔진 및 규칙 검증 |
| `npm run check:chosung` | 초성 게임 엔진 및 데이터 검증 |

백엔드 테스트는 다음 명령으로 실행합니다.

```bash
cd server
pytest tests/ -v
```

## 프로젝트 구조

```text
.
├─ public/             정적 파일 및 배포 설정
├─ scripts/            게임 규칙 검증 스크립트
├─ server/             FastAPI 백엔드 및 테스트
├─ src/
│  ├─ components/      공통 UI 컴포넌트
│  ├─ data/            게임 문제 데이터
│  ├─ game/            게임 엔진과 설정
│  ├─ lib/             API, 저장소 및 공통 유틸리티
│  └─ pages/           화면별 컴포넌트
└─ tests/              프런트엔드 테스트
```

## 데이터

- 산성비 게임: 남북한 단어쌍 500개
- 초성 게임: 북한말 문제 496개
- 런타임에는 외부 공공데이터 API를 호출하지 않고, 저장소에 포함된 정제 데이터를 사용합니다.

데이터의 이용과 출처 표기는 원천 데이터 제공기관의 이용 조건을 따릅니다.

## 배포 전 확인사항

- 운영 데이터베이스(Supabase)는 정해졌음 — Vercel 프로젝트 환경변수에 `DATABASE_URL` 등록 필요(위 "배포" 참고)
- 닉네임 금칙어 목록 확정 (`server/app/validation.py`는 샘플)
- 산성비 게임 점수 상한 검토 (`ACID_RAIN_SCORE_CEILING`)
- 트래픽이 늘어나면 요청 빈도 제한을 Redis 등 공유 저장소로 교체 검토
- 회사 보안 정책에 따른 저장소 공개 범위 확인

## 커밋 메시지 규칙

커밋 메시지는 Conventional Commits 형식을 사용하고 설명은 한국어로 작성합니다.

```text
feat: 새로운 기능 추가
fix: 오류 수정
docs: 문서 수정
refactor: 코드 구조 개선
test: 테스트 추가 또는 수정
chore: 설정 및 기타 작업
```

## 사용 및 배포

이 프로젝트는 회사 업무용 산출물입니다. 회사의 사전 승인 없이 소스 코드와 데이터를 외부에 복제·배포하거나 다른 목적으로 사용하지 않습니다.
