import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcidRainEngine } from '../src/game/AcidRainEngine'
import { TIME_STOP_WORD } from '../src/game/acidRainConfig'
import type { AcidRainPair } from '../src/lib/types'

let now = 0
let pending: FrameRequestCallback | null = null
const pool: AcidRainPair[] = Array.from({ length: 80 }, (_, index) => ({
  id: `pair-${index}`, north: `북한말${index}`, south: `남한말${index}`,
  north_answers: [`북한말${index}`], south_answers: [`남한말${index}`], difficulty: '보통',
}))

function frame(seconds: number) {
  for (let index = 0; index < Math.ceil(seconds * 10); index += 1) {
    now += 100
    const callback = pending
    pending = null
    callback?.(now)
  }
}

beforeEach(() => {
  now = 0
  pending = null
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => { pending = null })
})

describe('산성비게임 엔진 상태 전이', () => {
  it('오답은 콤보를 초기화한다', () => {
    const engine = new AcidRainEngine(pool, '보통')
    engine.start()
    frame(0.1)
    const word = engine.snapshot().words[0]
    engine.submit(word.answers[0])
    expect(engine.snapshot().combo).toBe(1)
    engine.submit('없는정답')
    expect(engine.snapshot()).toMatchObject({ combo: 0, feedback: { kind: 'wrong' } })
  })

  it('바닥에 닿은 단어를 누락으로 기록하고 일곱 번이면 종료한다', () => {
    const engine = new AcidRainEngine(pool, '보통', 0.01)
    engine.start()
    for (let index = 0; index < 7; index += 1) frame(3.3)
    expect(engine.snapshot()).toMatchObject({ status: 'over', defense: 0, words: [] })
    const result = engine.buildResult()
    expect(result.missed).toHaveLength(7)
    expect(result.missed.every((word) => word.reason === '놓침')).toBe(true)
  })

  it('13개 정답 후 두 번째 스테이지로 전환한다', () => {
    const engine = new AcidRainEngine(pool, '보통')
    engine.start()
    frame(0.1)
    for (let index = 0; index < 13; index += 1) {
      let word = engine.snapshot().words.find((candidate) => !candidate.isTimeStop)
      if (!word) {
        engine.submit(TIME_STOP_WORD)
        frame(3.3)
        word = engine.snapshot().words.find((candidate) => !candidate.isTimeStop)
      }
      expect(word).toBeDefined()
      engine.submit(word!.answers[0])
      if (index < 12) frame(3.3)
    }
    expect(engine.snapshot()).toMatchObject({ stage: 2, stageCorrect: 0, bannerStage: 2 })
    frame(1.2)
    expect(engine.snapshot().bannerStage).toBeNull()
  })

  it('여섯 번째 일반 단어 뒤 시간정지 단어를 생성하고 5초 동안 멈춘다', () => {
    const engine = new AcidRainEngine(pool, '보통')
    engine.start()
    frame(0.1)
    for (let index = 0; index < 6; index += 1) {
      const word = engine.snapshot().words.find((candidate) => !candidate.isTimeStop)
      expect(word).toBeDefined()
      engine.submit(word!.answers[0])
      frame(3.3)
    }
    const timeStop = engine.snapshot().words.find((word) => word.isTimeStop)
    expect(timeStop?.prompt).toBe(TIME_STOP_WORD)
    engine.submit(TIME_STOP_WORD)
    expect(engine.snapshot()).toMatchObject({ isTimeStopped: true, timeStopRemaining: 5 })
    frame(5.1)
    expect(engine.snapshot().isTimeStopped).toBe(false)
    expect(engine.buildResult().timeStopUses).toBe(1)
  })

  it('일시정지와 재개는 낙하 진행도를 보존한다', () => {
    const engine = new AcidRainEngine(pool, '보통')
    engine.start()
    frame(1)
    engine.pause()
    const progress = engine.snapshot().words[0].progress
    frame(2)
    expect(engine.snapshot().words[0].progress).toBe(progress)
    engine.resume()
    frame(1)
    expect(engine.snapshot().words[0].progress).toBeGreaterThan(progress)
  })

  it('풀이 5개 미만이어도 최근 출제 기억 창이 무한히 자라거나 거꾸로 동작하지 않는다', () => {
    // 코드리뷰로 발견: recentPairIds의 slice 창 크기 계산이 pool.length<5일 때
    // 음수가 두 번 뒤집혀 "최근 N개 유지"가 아니라 "앞 N개 삭제"가 됐다(실질적으로
    // 늘 빈 배열). pool.length===5일 때는 slice(-0)이라 아예 안 잘려 무한히 자랐다.
    const tinyPool: AcidRainPair[] = Array.from({ length: 3 }, (_, index) => ({
      id: `tiny-${index}`, north: `북${index}`, south: `남${index}`,
      north_answers: [`북${index}`], south_answers: [`남${index}`], difficulty: '보통',
    }))
    const engine = new AcidRainEngine(tinyPool, '보통') as unknown as {
      pickPair: () => AcidRainPair | null
      recentPairIds: string[]
    }
    for (let index = 0; index < 20; index += 1) engine.pickPair()
    // 버그 버전이면 항상 []였다(창 크기가 음수 -> 이중음수로 항상 잘려나감).
    expect(engine.recentPairIds.length).toBeGreaterThan(0)
    // pool.length===3일 때 창 크기는 max(1, min(40, 3-5))=1 이어야 한다 -
    // 무한히 자라나지 않고 항상 이 길이로 유지돼야 한다.
    expect(engine.recentPairIds.length).toBe(1)
  })
})
