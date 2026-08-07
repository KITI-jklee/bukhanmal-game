/** 브라우저 저장소 접근 — 닉네임(FR-CM-10)과 목업 랭킹 데이터 보관 */

const NICKNAME_KEY = 'tongil.nickname'
const PLAYER_KEY = 'tongil.player_key'

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* 사파리 프라이빗 모드 등에서 저장이 막혀도 게임 진행은 계속되어야 한다 */
  }
}

export function getNickname(): string | null {
  const stored = safeGet(NICKNAME_KEY)
  if (stored === null || validateNickname(stored) !== null) return null
  return normalizeNickname(stored)
}

export function setNickname(nickname: string): void {
  safeSet(NICKNAME_KEY, normalizeNickname(nickname))
}

/** DB 설계서(game_scores.player_key) — 브라우저별로 한 번만 생성해 두는
 * 익명 식별자. 닉네임이 겹쳐도 "내 최근 기록"을 구분하는 데 쓴다. 저장이
 * 막힌 환경(사파리 프라이빗 모드 등)에서는 매 호출마다 새로 발급되며,
 * 그때는 player_key가 요청마다 달라져도 점수 등록 자체는 계속 성공한다
 * (서버가 이 필드를 필수로 요구하지 않음 — schemas.py 참고). */
export function getPlayerKey(): string {
  const stored = safeGet(PLAYER_KEY)
  if (stored !== null) return stored
  const generated = crypto.randomUUID()
  safeSet(PLAYER_KEY, generated)
  return generated
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = safeGet(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  safeSet(key, JSON.stringify(value))
}

/** 닉네임 검증 — 서버(C-1)가 최종 검증하지만 클라이언트에서 먼저 걸러낸다 */
export function normalizeNickname(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function validateNickname(value: string): string | null {
  const normalized = normalizeNickname(value)
  if (normalized.length < 1) return '닉네임을 입력해 주세요.'
  if (normalized.length > 10) return '닉네임은 10자 이내로 입력해 주세요.'
  // 제어·방향 전환 문자와 혼동하기 쉬운 특수문자를 허용하지 않는다.
  if (!/^[가-힣a-zA-Z0-9 _-]+$/.test(normalized)) {
    return '한글, 영문, 숫자, 공백, 밑줄, 하이픈만 사용할 수 있어요.'
  }
  return null
}
