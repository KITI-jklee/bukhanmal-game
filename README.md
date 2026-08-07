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
| 데이터베이스 | SQLite |
| 테스트 | Vitest, pytest |
| 코드 검사 | Oxlint |

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

프런트엔드를 백엔드와 연결하려면 프로젝트 루트에 `.env.local`을 생성합니다.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

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

- 운영 데이터베이스 및 `DATABASE_URL` 설정
- 운영 환경의 API 주소와 환경변수 설정
- 닉네임 금칙어 목록 확정
- 산성비 게임 점수 상한 검토
- 다중 서버 운영 시 요청 빈도 제한 저장소 교체
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
