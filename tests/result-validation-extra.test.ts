import { describe, expect, it } from 'vitest'
import { isAcidRainResult, isChosungResult } from '../src/lib/types'

describe('결과 상태 경계값 검증', () => {
  const acidRain = {
    game: 'acid_rain', difficulty: '보통', score: 0, stageReached: 1,
    maxCombo: 0, correctCount: 0, timeStopUses: 0, timeStopClears: 0,
    playTimeSeconds: 1, missed: [],
  }

  it.each([
    ['score', -1], ['stageReached', 0], ['correctCount', 1.5],
    ['difficulty', '중간'], ['missed', [{ id: 'x' }]],
  ])('산성비 결과의 잘못된 %s 값을 거부한다', (field, value) => {
    expect(isAcidRainResult({ ...acidRain, [field]: value })).toBe(false)
  })

  const chosung = {
    game: 'chosung', difficulty: '보통', score: 12, rawScore: 10, multiplier: 1.2,
    correctCount: 1, noHintCorrectCount: 1, maxCombo: 1, hintsUsed: 0,
    playTimeSeconds: 3,
    questions: [{ id: 'q1', word: '정답', meaning: '뜻', southExpression: '표현', initials: 'ㅈㄷ', hintsUsed: 0, wrongCount: 0, earned: 10, outcome: '정답' }],
  }

  it('초성게임 정상 결과를 허용한다', () => {
    expect(isChosungResult(chosung)).toBe(true)
  })

  it.each([
    ['score', -1], ['rawScore', 1.5], ['multiplier', '1.2'],
    ['questions', [{ id: 'q1', word: '정답', initials: 'ㅈㄷ', outcome: '실패' }]],
  ])('초성게임 결과의 잘못된 %s 값을 거부한다', (field, value) => {
    expect(isChosungResult({ ...chosung, [field]: value })).toBe(false)
  })
})
