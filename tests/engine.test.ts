import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcidRainEngine } from '../src/game/AcidRainEngine'
import type { AcidRainPair } from '../src/lib/types'

let now = 0
let pending: FrameRequestCallback | null = null
const pool: AcidRainPair[] = Array.from({ length: 60 }, (_, index) => ({
  id: `p${index}`, north: `북${index}`, south: `남${index}`,
  north_answers: [`북${index}`], south_answers: [`남${index}`], difficulty: '보통',
}))

function advance(seconds: number) {
  for (let index = 0; index < Math.ceil(seconds * 62.5); index += 1) {
    now += 16
    const callback = pending
    pending = null
    callback?.(now)
  }
}

beforeEach(() => {
  now = 0
  pending = null
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => { pending = null })
})

describe('산성비 엔진', () => {
  it('즉시 단어를 생성하고 정답 점수를 계산한다', () => {
    const engine = new AcidRainEngine(pool, '보통')
    engine.start()
    advance(0.1)
    const word = engine.snapshot().words[0]
    expect(word).toBeDefined()
    engine.submit(word.answers[0])
    expect(engine.snapshot().score).toBe(12)
  })

  it('공백 제출은 콤보를 변경하지 않는다', () => {
    const engine = new AcidRainEngine(pool, '보통')
    engine.start()
    advance(0.1)
    engine.submit('   ')
    expect(engine.snapshot().combo).toBe(0)
  })
})
