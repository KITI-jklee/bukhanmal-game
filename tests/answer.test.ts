import { describe, expect, it } from 'vitest'
import { isCorrect, isNearMiss, isSubmittable, normalize } from '../src/lib/answer'

describe('정답 판정', () => {
  it('공백을 정규화하고 띄어쓰기 차이를 허용한다', () => {
    expect(normalize('  우리   말 ')).toBe('우리 말')
    expect(isCorrect('우리 말', ['우리말'])).toBe(true)
  })

  it('빈 값과 특수문자만 있는 값은 제출하지 않는다', () => {
    expect(isSubmittable('   ')).toBe(false)
    expect(isSubmittable('!!!')).toBe(false)
  })

  it('편집거리 1인 값을 근접 오답으로 판정한다', () => {
    expect(isNearMiss('도시락', ['도시락이'])).toBe(true)
  })
})
