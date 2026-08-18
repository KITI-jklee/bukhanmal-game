/** 산성비게임 밸런스 상수 — 상세기획서 4-2 ~ 4-7
 *
 * 숫자를 로직에 흩뿌리지 않고 한곳에 모아 밸런스 튜닝(9~10일차)이
 * 이 파일 수정만으로 끝나도록 한다. */

import type { Difficulty } from '../lib/types'

/** 빨간색 특수 단어. 이 문자열을 그대로 입력하면 5초 정지가 발동한다. */
export const TIME_STOP_WORD = '시간정지'
export const TIME_STOP_DURATION = 5

/** 난이도별 단어당 기본점수 (4-2) */
export const BASE_SCORE: Record<Difficulty, number> = {
  쉬움: 10,
  보통: 12,
  어려움: 15,
}

/** 북한말 제시 → 남한말 입력 비율 (4-1) */
export const NORTH_PROMPT_RATIO = 0.6

/** 방어 게이지 (4-7) */
export const DEFENSE_MAX = 100
export const DEFENSE_LOSS_PER_MISS = 15
export const MAX_MISSES = 7

/** 키보드로 가시 영역이 짧아지는 모바일에서는 입력 시간을 조금 더 확보한다. */
export const MOBILE_FALL_DURATION_SCALE = 1.12

export interface StageConfig {
  stage: number
  /** 다음 스테이지 진입에 필요한 일반 단어 정답 수. 3단계는 무한 생존. */
  target: number | null
  /** 최상단에서 바닥까지 걸리는 시간(초). 픽셀 속도가 아니라 시간 기준(4-3). */
  fallDuration: number
  /** 단어 생성 간격(초) */
  spawnInterval: number
  /** 동시 출현 최대 개수 */
  maxConcurrent: number
  /** 스테이지 점수 보너스 */
  bonus: number
  /** 시간정지 단어 출현 간격(해당 스테이지 정답 수 기준) */
  timeStopEvery: number
  /** 시간정지 단어를 몇 번까지 출현시킬지. null이면 반복. */
  timeStopLimit: number | null
}

// 2026-08-19 밸런스 조정: 게임이 전반적으로 어렵다는 피드백에 따라 시간정지
// 단어(플레이어에게 유리한 구제 아이템)가 더 자주 나오도록 출현 간격을
// 줄이고, 스테이지1·2도 스테이지3처럼 반복 출현하게 했다(기존엔 1회뿐).
// 이후 세 스테이지 모두 6개마다 반복으로 통일했다(같은 날 2차 조정).
export const STAGES: StageConfig[] = [
  {
    stage: 1,
    target: 13,
    fallDuration: 10,
    spawnInterval: 3.2,
    maxConcurrent: 2,
    bonus: 0,
    timeStopEvery: 6,
    timeStopLimit: null,
  },
  {
    stage: 2,
    target: 18,
    fallDuration: 7,
    spawnInterval: 2.2,
    maxConcurrent: 3,
    bonus: 3,
    timeStopEvery: 6,
    timeStopLimit: null,
  },
  {
    stage: 3,
    target: null,
    fallDuration: 5,
    spawnInterval: 1.5,
    maxConcurrent: 4,
    bonus: 5,
    timeStopEvery: 6,
    timeStopLimit: null,
  },
]

/** 3단계 가속 — 일반 단어 10개 정답마다 단축, 하한선 있음 (4-3) */
export const STAGE3_SPEEDUP_EVERY = 10
export const STAGE3_FALL_STEP = 0.3
export const STAGE3_SPAWN_STEP = 0.1
export const STAGE3_MIN_FALL = 3
export const STAGE3_MIN_SPAWN = 0.8

/** 연속 정답 수에 따른 점수 배수 (4-4) */
export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 3
  if (combo >= 5) return 2
  return 1
}

/** 방어 게이지 색상 구간 (4-7) */
export function defenseTone(percent: number): 'ok' | 'warn' | 'danger' {
  if (percent >= 61) return 'ok'
  if (percent >= 31) return 'warn'
  return 'danger'
}
