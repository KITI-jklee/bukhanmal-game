import { describe, expect, it } from 'vitest'
import { AcidRainEngine } from '../src/game/AcidRainEngine'
import { ChosungEngine } from '../src/game/ChosungEngine'

describe('빈 문제 데이터 예외 처리', () => {
  it('초성게임은 실행 루프 대신 오류 상태가 된다', () => {
    const engine = new ChosungEngine([], '보통')

    engine.start()

    expect(engine.snapshot().status).toBe('error')
    expect(engine.snapshot().totalQuestions).toBe(0)
  })

  it('산성비게임은 실행 루프 대신 오류 상태가 된다', () => {
    const engine = new AcidRainEngine([], '보통')

    engine.start()

    expect(engine.snapshot().status).toBe('error')
    expect(engine.snapshot().words).toEqual([])
  })
})
