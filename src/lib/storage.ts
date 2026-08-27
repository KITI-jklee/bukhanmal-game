/** 브라우저 저장소 접근 — 닉네임(FR-CM-10)과 목업 랭킹 데이터 보관 */

import { MAX_NICKNAME_LENGTH } from './constants'

const NICKNAME_KEY = 'tongil.nickname'

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
  if (normalized.length > MAX_NICKNAME_LENGTH) return `닉네임은 ${MAX_NICKNAME_LENGTH}자 이내로 입력해 주세요.`
  // 제어·방향 전환 문자와 혼동하기 쉬운 특수문자를 허용하지 않는다.
  if (!/^[가-힣a-zA-Z0-9 _-]+$/.test(normalized)) {
    return '한글, 영문, 숫자, 공백, 밑줄, 하이픈만 사용할 수 있어요.'
  }
  return null
}
