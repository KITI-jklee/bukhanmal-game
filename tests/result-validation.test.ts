import { describe, expect, it } from 'vitest'
import { isAcidRainResult, normalizeDifficulty } from '../src/lib/types'

describe('결과 상태 검증', () => {
  it('불완전한 history state를 거부한다', () => {
    expect(isAcidRainResult({ score: 10 })).toBe(false)
  })

  it('정상 결과를 허용한다', () => {
    expect(isAcidRainResult({
      game: 'acid_rain', difficulty: '보통', score: 0,
      stageReached: 1, maxCombo: 0, correctCount: 0, timeStopUses: 0,
      timeStopClears: 0, playTimeSeconds: 1, missed: [],
    })).toBe(true)
  })
})

describe('난이도 이름 변환', () => {
  it('이전 난이도 이름을 새 이름으로 변환한다', () => {
    expect(normalizeDifficulty('이지')).toBe('쉬움')
    expect(normalizeDifficulty('노멀')).toBe('보통')
    expect(normalizeDifficulty('하드')).toBe('어려움')
  })

  it('새 난이도 이름은 그대로 유지한다', () => {
    expect(normalizeDifficulty('쉬움')).toBe('쉬움')
    expect(normalizeDifficulty('보통')).toBe('보통')
    expect(normalizeDifficulty('어려움')).toBe('어려움')
  })
})
