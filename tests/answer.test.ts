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

  it('NFD(자모 분리형)로 들어온 입력도 NFC 정답과 같은 글자로 인식한다', () => {
    // 옛 macOS/HFS+ 파일명 등에서 붙여넣기로 들어올 수 있는 분해형 유니코드 -
    // 코드리뷰로 발견: normalize()가 NFC 정규화를 안 해서 눈에는 같은 글자인데도
    // 오답 처리되거나(심지어 isSubmittable도 통과 못 해 제출 자체가 무시될 수 있었다).
    const nfd = '통일'.normalize('NFD')
    expect(nfd).not.toBe('통일') // 바이트 표현 자체가 다름을 먼저 확인
    expect(isSubmittable(nfd)).toBe(true)
    expect(isCorrect(nfd, ['통일'])).toBe(true)
    expect(normalize(nfd)).toBe(normalize('통일'))
  })
})
