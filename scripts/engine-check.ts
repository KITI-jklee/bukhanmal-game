/** 산성비게임 엔진 규칙 검증 하니스
 *
 * 브라우저 없이 게임 루프를 가상 시계로 돌려 기획서 4장의 수치가
 * 실제로 그렇게 동작하는지 확인한다.  실행: npm run check:engine */

import { AcidRainEngine } from '../src/game/AcidRainEngine'
import { TIME_STOP_WORD } from '../src/game/acidRainConfig'
import type { AcidRainPair } from '../src/lib/types'

// ── 가상 시계 · rAF 목 ─────────────────────────────

let virtualTime = 0
let pending: ((time: number) => void) | null = null

globalThis.performance = { now: () => virtualTime } as Performance
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
  pending = cb
  return 1
}
globalThis.cancelAnimationFrame = () => {
  pending = null
}

/** 16ms 단위로 프레임을 진행시킨다 */
function advance(seconds: number): void {
  const steps = Math.round((seconds * 1000) / 16)
  for (let i = 0; i < steps; i += 1) {
    virtualTime += 16
    const cb = pending
    pending = null
    cb?.(virtualTime)
  }
}

// ── 테스트용 단어 풀 ───────────────────────────────

const POOL: AcidRainPair[] = Array.from({ length: 60 }, (_, i) => ({
  id: `p${i}`,
  north: `북${i}`,
  south: `남${i}`,
  north_answers: [`북${i}`],
  south_answers: [`남${i}`],
  difficulty: '보통' as const,
}))

// ── 단언 헬퍼 ──────────────────────────────────────

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  →  기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`}`)
}

/** 화면의 첫 단어를 정답 처리한다. 단어가 없으면 나올 때까지 기다린다. */
function answerOne(engine: AcidRainEngine): boolean {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const word = engine.snapshot().words.find((w) => !w.isTimeStop)
    if (word) {
      engine.submit(word.answers[0])
      return true
    }
    advance(0.1)
    if (engine.snapshot().status === 'over') return false
  }
  return false
}

function newEngine() {
  virtualTime = 0
  pending = null
  const engine = new AcidRainEngine(POOL, '보통')
  engine.start()
  return engine
}

// ── 1. 스폰 · 스테이지1 기본값 ─────────────────────

console.log('\n[1] 스폰과 스테이지1 기본값')
{
  const engine = newEngine()
  advance(0.1)
  const first = engine.snapshot()
  check('시작 직후 첫 단어가 떨어진다', first.words.length, 1)
  check('스테이지1 낙하시간 10초', first.words[0].fallDuration, 10)
  check('스테이지 목표 13개', first.stageTarget, 13)
  check('방어 게이지 100%', first.defense, 100)

  advance(3.3)
  check('3.2초 뒤 두 번째 단어', engine.snapshot().words.length, 2)
  advance(3.3)
  check('동시 출현 상한 2개', engine.snapshot().words.length, 2)
}

// ── 2. 점수 · 콤보 배수 ────────────────────────────

console.log('\n[2] 점수와 콤보 배수  (보통 난이도 기본 12점, 스테이지1 보너스 0)')
{
  const engine = newEngine()
  advance(0.1)

  answerOne(engine)
  check('1콤보 ×1 → 12점', engine.snapshot().score, 12)

  for (let i = 0; i < 3; i += 1) answerOne(engine)
  check('4콤보까지 ×1 → 48점', engine.snapshot().score, 48)

  answerOne(engine)
  check('5콤보부터 ×2 → 48+24=72점', engine.snapshot().score, 72)
  check('콤보 배수 2', engine.snapshot().multiplier, 2)

  for (let i = 0; i < 4; i += 1) answerOne(engine)
  check('9콤보까지 ×2 → 72+96=168점', engine.snapshot().score, 168)

  answerOne(engine)
  check('10콤보부터 ×3 → 168+36=204점', engine.snapshot().score, 204)
  check('콤보 배수 3', engine.snapshot().multiplier, 3)
}

// ── 3. 오답 · 콤보 초기화 ──────────────────────────

console.log('\n[3] 오답 처리')
{
  const engine = newEngine()
  advance(0.1)
  answerOne(engine)
  answerOne(engine)
  check('2콤보', engine.snapshot().combo, 2)

  engine.submit('없는단어')
  check('오답 시 콤보 초기화', engine.snapshot().combo, 0)
  check('오답은 방어 게이지를 깎지 않는다', engine.snapshot().defense, 100)
  check('오답은 점수를 깎지 않는다', engine.snapshot().score, 24)

  const before = engine.snapshot()
  engine.submit('   ')
  engine.submit('!!!')
  check('공백·특수문자 제출은 무시', engine.snapshot().combo, before.combo)
}

// ── 4. 시간정지 단어 ───────────────────────────────

console.log('\n[4] 시간정지 단어 (스테이지1: 4개 정답마다 반복, 2026-08-19 밸런스 조정)')
{
  const engine = newEngine()
  advance(0.1)
  for (let i = 0; i < 4; i += 1) answerOne(engine)
  check('4개 정답 완료', engine.snapshot().stageCorrect, 4)

  advance(4)
  const hasStop = engine.snapshot().words.some((w) => w.isTimeStop)
  check('시간정지 단어 출현', hasStop, true)

  const scoreBefore = engine.snapshot().score
  const comboBefore = engine.snapshot().combo
  engine.submit(TIME_STOP_WORD)
  const stopped = engine.snapshot()
  check('정지 모드 진입', stopped.isTimeStopped, true)
  check('시간정지는 점수에 포함되지 않는다', stopped.score, scoreBefore)
  check('시간정지는 콤보를 유지한다', stopped.combo, comboBefore)
  check('시간정지는 스테이지 정답 수에서 제외', stopped.stageCorrect, 4)

  // 정지 중에는 일반 단어가 내려오지 않아야 한다
  const frozen = engine.snapshot().words.filter((w) => !w.isTimeStop)
  const topsBefore = frozen.map((w) => w.progress)
  advance(1)
  const topsAfter = engine
    .snapshot()
    .words.filter((w) => !w.isTimeStop)
    .map((w) => w.progress)
  check('정지 중 낙하 멈춤', topsAfter, topsBefore)

  // 정지 중 정답도 정상 점수·스테이지 정답 수에 포함
  if (frozen.length > 0) {
    engine.submit(frozen[0].answers[0])
    check('정지 중 정답도 스테이지 정답 수에 포함', engine.snapshot().stageCorrect, 5)
  }

  advance(5)
  check('5초 뒤 정지 해제', engine.snapshot().isTimeStopped, false)
}

// ── 5. 스테이지 전환 ───────────────────────────────

console.log('\n[5] 스테이지 전환 (13개 → STAGE 2)')
{
  const engine = newEngine()
  advance(0.1)
  for (let i = 0; i < 13; i += 1) {
    if (!answerOne(engine)) break
  }
  check('전환 배너 표시', engine.snapshot().bannerStage, 2)
  check('배너 중 화면 정리', engine.snapshot().words.length, 0)

  advance(1.3)
  const s2 = engine.snapshot()
  check('스테이지2 진입', s2.stage, 2)
  check('스테이지2 목표 18개', s2.stageTarget, 18)
  check('스테이지 정답 수 초기화', s2.stageCorrect, 0)

  advance(0.2)
  check('스테이지2 낙하시간 7초', engine.snapshot().words[0]?.fallDuration, 7)

  const scoreBefore = engine.snapshot().score
  answerOne(engine)
  const gained = engine.snapshot().score - scoreBefore
  // 13개를 연속으로 맞혔으므로 콤보는 10 이상 → ×3, (12+3)×3 = 45
  check('스테이지2 보너스 +3 반영 → (12+3)×3', gained, 45)
}

// ── 6. 방어 게이지 · 게임오버 ──────────────────────

console.log('\n[6] 방어 게이지와 게임오버')
{
  const engine = newEngine()
  advance(0.1)
  answerOne(engine)
  check('정답 1개 후 콤보 1', engine.snapshot().combo, 1)

  // 아무것도 입력하지 않고 방치해 게이지가 실제로 밟는 값을 순서대로 모은다.
  // 한 번에 여러 단어가 바닥에 닿을 수 있으므로 작은 간격으로 진행시킨다.
  const gaugeSteps: number[] = [engine.snapshot().defense]
  let comboAtFirstMiss: number | null = null

  for (let i = 0; i < 4000; i += 1) {
    advance(0.05)
    const now = engine.snapshot()
    if (now.defense !== gaugeSteps[gaugeSteps.length - 1]) {
      gaugeSteps.push(now.defense)
      comboAtFirstMiss ??= now.combo
    }
    if (now.status === 'over') break
  }

  check('게이지가 15%씩 정확히 감소', gaugeSteps, [100, 85, 70, 55, 40, 25, 10, 0])
  check('단어 놓침 → 콤보 초기화', comboAtFirstMiss, 0)
  check('7번째 놓침에 게임오버', engine.snapshot().status, 'over')

  const result = engine.buildResult()
  check('결과에 놓친 단어 7개 기록', result.missed.length, 7)
  check('결과 게임 구분', result.game, 'acid_rain')
}

// ── 7. 일시정지 ────────────────────────────────────

console.log('\n[7] 일시정지')
{
  const engine = newEngine()
  advance(0.5)
  const before = engine.snapshot().words.map((w) => w.progress)
  engine.pause()
  check('일시정지 상태', engine.snapshot().status, 'paused')
  advance(3)
  check('정지 중 낙하 없음', engine.snapshot().words.map((w) => w.progress), before)
  engine.resume()
  advance(0.5)
  const after = engine.snapshot().words.map((w) => w.progress)
  check('재개 후 낙하 계속', after[0] > before[0], true)
}

// ── 8. 중복 출제 방지 ──────────────────────────────

console.log('\n[8] 동시 출제 중복 방지')
{
  const engine = newEngine()
  let violation = false
  for (let i = 0; i < 300; i += 1) {
    advance(0.1)
    const words = engine.snapshot().words
    const answers = words.flatMap((w) => w.answers)
    if (new Set(answers).size !== answers.length) violation = true
    if (new Set(words.map((w) => w.pairId)).size !== words.length) violation = true
    if (engine.snapshot().status === 'over') break
  }
  check('화면에 같은 정답·같은 단어쌍이 동시에 없다', violation, false)
}

// ── 9. 스테이지3 가속과 하한선 ─────────────────────

console.log('\n[9] 스테이지3 가속 (10개마다 -0.3초, 최소 3초)')
{
  const engine = newEngine()
  advance(0.1)

  // 13개 + 18개를 맞혀 스테이지3까지 올라간다
  for (let i = 0; i < 13; i += 1) answerOne(engine)
  advance(1.3)
  for (let i = 0; i < 18; i += 1) answerOne(engine)
  advance(1.3)

  check('스테이지3 진입', engine.snapshot().stage, 3)
  check('스테이지3는 무한 생존', engine.snapshot().stageTarget, null)

  advance(0.2)
  check('스테이지3 시작 낙하시간 5초', engine.snapshot().words[0]?.fallDuration, 5)

  // 10개 정답마다 낙하시간이 0.3초씩 짧아진다
  const expectedFall = [4.7, 4.4, 4.1, 3.8, 3.5, 3.2, 3, 3]
  for (let round = 0; round < expectedFall.length; round += 1) {
    for (let i = 0; i < 10; i += 1) answerOne(engine)
    // 새로 스폰된 단어에 새 낙하시간이 적용된다
    const before = new Set(engine.snapshot().words.map((w) => w.key))
    let fresh: number | undefined
    for (let i = 0; i < 200 && fresh === undefined; i += 1) {
      advance(0.1)
      fresh = engine.snapshot().words.find((w) => !before.has(w.key))?.fallDuration
    }
    check(
      `${(round + 1) * 10}개 정답 후 낙하시간 ${expectedFall[round]}초`,
      Number(fresh?.toFixed(2)),
      expectedFall[round],
    )
  }

  check('최소 낙하시간 3초 하한 유지', engine.snapshot().words[0]?.fallDuration >= 3, true)
  check('동시 출현 상한 4개', engine.snapshot().words.length <= 4, true)
}

console.log(`\n${failures === 0 ? '전체 통과' : `${failures}건 실패`}`)
process.exit(failures === 0 ? 0 : 1)
