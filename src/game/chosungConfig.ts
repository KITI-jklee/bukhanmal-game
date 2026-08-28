/* 초성게임 규칙 상수 — 상세기획서 3장 수치는 전부 여기 모아두고 엔진·UI·안내 모달이 같은 값을 참조한다. */

import type { Difficulty } from '../lib/types'

/** 한 판 문제 수 (FR-CH-01) */
export const QUESTIONS_PER_ROUND = 10

/** 문제당 제한시간. 난이도와 무관하게 동일 (FR-CH-02) */
export const TIME_LIMIT_SECONDS = 20

/** 문제당 오답 기회 = 하트 개수 (FR-CH-06) */
export const MAX_WRONG = 3

/** 힌트 최대 단계 (FR-CH-04) */
export const MAX_HINT_LEVEL = 2

/* 힌트 사용 단계별 정답 시 기본점수 (FR-CH-05) index = 사용한 힌트 수 */
export const HINT_SCORE = [10, 5, 2] as const

/** 난이도별 총점 배수 (FR-CH-10) */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  쉬움: 1.0,
  보통: 1.2,
  어려움: 1.5,
}

/* 무힌트·무오답 연속 정답 수에 따른 콤보 보너스 (FR-CH-09) 1연속 0점 / 2연속 +2 / 3연속 +3 / 4연속 +4 / 5연속 이상 +5(상한) */
export function comboBonus(combo: number): number {
  if (combo >= 5) return 5
  if (combo >= 2) return combo
  return 0
}

/** 받침 유무에 따라 알맞은 조사를 고른다. "논리을(를)" 같은 어색한 표기를 피하기 위함. */
export function particleFor(word: string, withBatchim: string, withoutBatchim: string): string {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00
  // 한글 음절이 아니면 판단할 수 없으므로 받침 없는 쪽으로 둔다
  if (Number.isNaN(code) || code < 0 || code > 11171) return withoutBatchim
  return code % 28 > 0 ? withBatchim : withoutBatchim
}

/* 2단계 힌트 — 첫 번째 초성을 실제 글자로 바꾼다 (상세 3-3) 예: ㅇㅇㅂㅅㅇ → 얼ㅇㅂㅅㅇ */
export function revealFirstLetter(initials: string, firstLetter: string): string {
  return firstLetter + initials.slice(1)
}

/* 남한말 대응어(south_expression) 정보가 원천 데이터에 없는 단어를 위한 힌트 단계 보정. */
export function effectiveMaxHintLevel(southExpression: string): number {
  return southExpression.trim().length > 0 ? MAX_HINT_LEVEL : 1
}

/* 남한말 힌트가 없는 단어에서, 지금 힌트 단계에 "첫 글자"를 보여줘야 하는지 여부. */
export function shouldRevealFirstLetter(hintLevel: number, southExpression: string): boolean {
  if (southExpression.trim().length > 0) return hintLevel >= 2
  return hintLevel >= 1
}
