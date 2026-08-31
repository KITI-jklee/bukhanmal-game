import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChosungEngine } from '../src/game/ChosungEngine'
import type { ChosungWord } from '../src/lib/types'

let now = 0
let pending: FrameRequestCallback | null = null
const words: ChosungWord[] = Array.from({ length: 10 }, (_, index) => ({
  id: `word-${index}`, word: `정답${index}`, accepted_answers: [`정답${index}`],
  meaning: `뜻 ${index}`, south_expression: `남한말${index}`, initials: `ㅈㄷ${index}`,
  first_letter: '정', length: 3, difficulty: '보통',
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
  vi.spyOn(Math, 'random').mockReturnValue(0.999)
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => { pending = null })
})

describe('초성게임 엔진', () => {
  it('정답, 콤보, 힌트 점수를 계산하고 결과에 기록한다', () => {
    const engine = new ChosungEngine(words, '보통')
    engine.start()
    engine.submit('정답0')
    expect(engine.snapshot()).toMatchObject({ score: 10, combo: 1, maxCombo: 1 })
    engine.next()
    engine.useHint()
    expect(engine.snapshot()).toMatchObject({ hintLevel: 1, southHint: '남한말1', combo: 0 })
    engine.submit('정답1')
    expect(engine.buildResult()).toMatchObject({ rawScore: 15, score: 18, correctCount: 2, noHintCorrectCount: 1, maxCombo: 1, hintsUsed: 1 })
    expect(engine.buildResult().questions.map((question) => question.earned)).toEqual([10, 5])
  })

  it('근접 오답을 안내하고 세 번째 오답에 정답 공개를 연다', () => {
    const engine = new ChosungEngine(words, '보통')
    engine.start()
    engine.submit('정답')
    expect(engine.snapshot()).toMatchObject({ hearts: 2, feedback: { kind: 'near' } })
    engine.submit('완전히다름')
    expect(engine.snapshot()).toMatchObject({ hearts: 1, feedback: { kind: 'wrong' } })
    engine.submit('또다름')
    expect(engine.snapshot()).toMatchObject({ hearts: 0, reveal: { outcome: '오답' } })
  })

  it('시간이 끝나면 시간 초과를 기록한다', () => {
    const engine = new ChosungEngine(words, '보통')
    engine.start()
    frame(20.1)
    expect(engine.snapshot().reveal?.outcome).toBe('시간 초과')
    expect(engine.buildResult().questions[0]).toMatchObject({ outcome: '시간 초과', earned: 0 })
  })

  it('일시정지 중에는 시간이 흐르지 않고 재개 후 다시 흐른다', () => {
    const engine = new ChosungEngine(words, '보통')
    engine.start()
    frame(1)
    engine.pause()
    const pausedAt = engine.snapshot().remainingSeconds
    frame(2)
    expect(engine.snapshot().remainingSeconds).toBe(pausedAt)
    engine.resume()
    frame(1)
    expect(engine.snapshot().remainingSeconds).toBeLessThan(pausedAt)
  })

  it('모든 문제를 진행하면 종료하고 난이도 배수를 적용한다', () => {
    const hardWords = words.map((word) => ({ ...word, difficulty: '어려움' as const }))
    const engine = new ChosungEngine(hardWords, '어려움')
    engine.start()
    for (let index = 0; index < hardWords.length; index += 1) {
      engine.submit(`정답${index}`)
      engine.next()
    }
    expect(engine.snapshot().status).toBe('over')
    expect(engine.buildResult()).toMatchObject({ rawScore: 139, score: 209, correctCount: 10 })
  })

  it('구독 해제와 destroy 이후에는 알림을 보내지 않는다', () => {
    const engine = new ChosungEngine(words, '보통')
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    engine.start()
    expect(listener).toHaveBeenCalledTimes(1)
    engine.destroy()
    expect(pending).toBeNull()
  })
})
