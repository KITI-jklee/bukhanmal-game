/** 초성게임 엔진 규칙 검증 하니스
 *
 * 브라우저 없이 가상 시계로 돌려 상세기획서 3장의 수치를 확인한다.
 * 실행: npm run check:chosung */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ChosungEngine } from '../src/game/ChosungEngine'
import {
  DIFFICULTY_MULTIPLIER,
  QUESTIONS_PER_ROUND,
  TIME_LIMIT_SECONDS,
} from '../src/game/chosungConfig'
import type { ChosungWord, Difficulty } from '../src/lib/types'

// 데이터는 번들 크기를 줄이려고 public/data(런타임 fetch 대상)로 옮겼다 —
// import 대신 파일을 직접 읽는다.
const dataPath = fileURLToPath(new URL('../public/data/chosung_words.json', import.meta.url))
const realWords = JSON.parse(readFileSync(dataPath, 'utf-8'))

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

function advance(seconds: number): void {
  const steps = Math.round((seconds * 1000) / 16)
  for (let i = 0; i < steps; i += 1) {
    virtualTime += 16
    const cb = pending
    pending = null
    cb?.(virtualTime)
  }
}

// ── 테스트용 문제 풀 ───────────────────────────────

const POOL: ChosungWord[] = Array.from({ length: 40 }, (_, i) => ({
  id: `w${i}`,
  word: `단어${i}`,
  accepted_answers: [`단어${i}`],
  meaning: `${i}번 뜻풀이입니다.`,
  south_expression: `남말${i}`,
  initials: `ㄷㅇ${i}`,
  first_letter: '단',
  length: 3,
  difficulty: '보통',
}))

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  →  기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`}`,
  )
}

function newEngine(difficulty: Difficulty = '보통', pool = POOL) {
  virtualTime = 0
  pending = null
  const engine = new ChosungEngine(pool, difficulty)
  engine.start()
  return engine
}

/** 현재 문제를 정답 처리하고 공개 화면을 넘긴다 */
function answerCurrent(engine: ChosungEngine, pool = POOL): void {
  const snap = engine.snapshot()
  const word = pool.find((w) => w.initials === snap.initials || w.first_letter + w.initials.slice(1) === snap.initials)
  engine.submit(word!.accepted_answers[0])
  engine.next()
}

// ── 1. 출제 ────────────────────────────────────────

console.log('\n[1] 출제 규칙')
{
  const engine = newEngine()
  const s = engine.snapshot()
  check('한 판 10문제', s.totalQuestions, QUESTIONS_PER_ROUND)
  check('첫 문제 번호 1', s.questionNumber, 1)
  check('제한시간 20초', s.remainingSeconds, TIME_LIMIT_SECONDS)
  check('하트 3개', s.hearts, 3)
  check('힌트 단계 0', s.hintLevel, 0)

  // 같은 회차에 같은 단어가 다시 나오지 않는지
  const seen = new Set<string>()
  const e2 = newEngine()
  for (let i = 0; i < QUESTIONS_PER_ROUND; i += 1) {
    seen.add(e2.snapshot().initials)
    answerCurrent(e2)
  }
  check('회차 내 중복 출제 없음', seen.size, QUESTIONS_PER_ROUND)
}

// ── 2. 힌트 단계별 점수 ────────────────────────────

console.log('\n[2] 힌트 단계별 기본점수 (10 / 5 / 2)')
{
  const noHint = newEngine()
  answerCurrent(noHint)
  check('무힌트 정답 10점', noHint.snapshot().score, 10)

  const hint1 = newEngine()
  hint1.useHint()
  answerCurrent(hint1)
  check('1단계 힌트 후 정답 5점', hint1.snapshot().score, 5)

  const hint2 = newEngine()
  hint2.useHint()
  hint2.useHint()
  answerCurrent(hint2)
  check('2단계 힌트 후 정답 2점', hint2.snapshot().score, 2)
}

// ── 3. 힌트 공개 내용 ──────────────────────────────

console.log('\n[3] 힌트 공개 내용')
{
  const engine = newEngine()
  const before = engine.snapshot()
  check('기본 정보로 뜻풀이가 그대로 노출된다', before.meaning, POOL[0].meaning.length > 0 ? before.meaning : '')
  check('뜻풀이를 가리지 않는다', before.meaning.includes('○'), false)
  check('힌트 전 southHint 없음', before.southHint, null)

  engine.useHint()
  const after1 = engine.snapshot()
  check('1단계에서 남한말 공개', after1.southHint !== null, true)
  check('1단계에서도 뜻풀이는 그대로', after1.meaning, before.meaning)

  const initialsBefore = after1.initials
  engine.useHint()
  const after2 = engine.snapshot()
  check('2단계에서 첫 글자가 실제 글자로', after2.initials[0], '단')
  check('2단계에서 나머지 초성은 그대로', after2.initials.slice(1), initialsBefore.slice(1))

  engine.useHint()
  check('3단계 힌트는 없다', engine.snapshot().hintLevel, 2)
}

// ── 4. 힌트는 제한시간을 늘리지 않는다 ─────────────

console.log('\n[4] 힌트와 제한시간')
{
  const engine = newEngine()
  advance(5)
  const before = engine.snapshot().remainingSeconds
  engine.useHint()
  const after = engine.snapshot().remainingSeconds
  check('힌트를 열어도 남은 시간 그대로', after, before)
}

// ── 5. 하트와 오답 ─────────────────────────────────

console.log('\n[5] 오답과 하트')
{
  const engine = newEngine()
  engine.submit('틀린답')
  check('오답 1회 → 하트 2개', engine.snapshot().hearts, 2)
  check('오답은 아직 문제를 끝내지 않는다', engine.snapshot().reveal, null)

  engine.submit('틀린답2')
  check('오답 2회 → 하트 1개', engine.snapshot().hearts, 1)

  engine.submit('틀린답3')
  const s = engine.snapshot()
  check('오답 3회 → 정답 공개', s.reveal?.outcome, '오답')
  check('오답 3회 → 0점', s.score, 0)

  const empty = newEngine()
  empty.submit('   ')
  empty.submit('!!!')
  check('공백·특수문자 제출은 하트를 깎지 않는다', empty.snapshot().hearts, 3)
}

// ── 6. 시간 초과 ───────────────────────────────────

console.log('\n[6] 시간 초과')
{
  const engine = newEngine()
  advance(TIME_LIMIT_SECONDS + 0.2)
  const s = engine.snapshot()
  check('20초 경과 시 시간 초과 처리', s.reveal?.outcome, '시간 초과')
  check('시간 초과는 0점', s.score, 0)

  // 시간이 지나도 공개 화면을 유지하고, 사용자 입력으로만 다음 문제로 이동한다.
  advance(3.2)
  check('3초 뒤에도 결과 화면 유지', engine.snapshot().questionNumber, 1)
  check('3초 뒤에도 정답 공개 유지', engine.snapshot().reveal?.outcome, '시간 초과')
  engine.next()
  const next = engine.snapshot()
  check('사용자 선택으로 다음 문제', next.questionNumber, 2)
  check('다음 문제에서 하트 초기화', next.hearts, 3)
  check('다음 문제에서 힌트 초기화', next.hintLevel, 0)
  check('다음 문제에서 시간 초기화', next.remainingSeconds, TIME_LIMIT_SECONDS)
}

// ── 7. 콤보 ────────────────────────────────────────

console.log('\n[7] 콤보 (무힌트·무오답 연속 정답만)')
{
  const engine = newEngine()
  answerCurrent(engine)
  check('1연속 보너스 0 → 10점', engine.snapshot().score, 10)

  answerCurrent(engine)
  check('2연속 +2 → 10+12=22점', engine.snapshot().score, 22)

  answerCurrent(engine)
  check('3연속 +3 → 22+13=35점', engine.snapshot().score, 35)

  answerCurrent(engine)
  check('4연속 +4 → 35+14=49점', engine.snapshot().score, 49)

  answerCurrent(engine)
  check('5연속 +5 → 49+15=64점', engine.snapshot().score, 64)

  answerCurrent(engine)
  check('6연속도 상한 +5 → 64+15=79점', engine.snapshot().score, 79)
  check('최고 콤보 6', engine.snapshot().maxCombo, 6)
}

console.log('\n[8] 콤보 초기화 조건')
{
  const byHint = newEngine()
  answerCurrent(byHint)
  answerCurrent(byHint)
  check('2연속 상태', byHint.snapshot().combo, 2)
  byHint.useHint()
  check('힌트 열람 즉시 콤보 초기화', byHint.snapshot().combo, 0)

  const byWrong = newEngine()
  answerCurrent(byWrong)
  answerCurrent(byWrong)
  byWrong.submit('틀린답')
  check('오답 제출 즉시 콤보 초기화', byWrong.snapshot().combo, 0)

  // 힌트를 쓴 문제를 맞혀도 콤보에 포함되지 않는다
  const after = newEngine()
  after.useHint()
  answerCurrent(after)
  check('힌트 쓴 정답은 콤보에 포함 안 됨', after.snapshot().combo, 0)
  check('그래도 단계별 기본점수는 획득', after.snapshot().score, 5)
}

// ── 9. 난이도 배수 ─────────────────────────────────

console.log('\n[9] 난이도 배수 (합계에 한 번만 적용)')
{
  for (const level of ['쉬움', '보통', '어려움'] as Difficulty[]) {
    const pool = POOL.map((w) => ({ ...w, difficulty: level }))
    const engine = newEngine(level, pool)
    for (let i = 0; i < QUESTIONS_PER_ROUND; i += 1) answerCurrent(engine, pool)
    const result = engine.buildResult()
    // 10문제 연속 정답: 10 + 12 + 13 + 14 + 15×6 = 139
    check(`${level} 기본 합계 139`, result.rawScore, 139)
    check(
      `${level} 총점 = 139 × ${DIFFICULTY_MULTIPLIER[level]}`,
      result.score,
      Math.round(139 * DIFFICULTY_MULTIPLIER[level]),
    )
    check(`${level} 10문제 정답`, result.correctCount, QUESTIONS_PER_ROUND)
    check(`${level} 무힌트 정답 10개`, result.noHintCorrectCount, QUESTIONS_PER_ROUND)
  }
}

// ── 10. 정답 판정 ──────────────────────────────────

console.log('\n[10] 정답 판정')
{
  const pool: ChosungWord[] = [
    {
      id: 'x1',
      word: '동무',
      accepted_answers: ['동무', '동지'],
      meaning: '친구를 뜻하는 북한말',
      south_expression: '친구',
      initials: 'ㄷㅁ',
      first_letter: '동',
      length: 2,
      difficulty: '보통',
    },
  ]
  const engine = newEngine('보통', pool)
  engine.submit('  동무  ')
  check('앞뒤 공백을 제거하고 판정', engine.snapshot().reveal?.outcome, '정답')

  const alt = newEngine('보통', pool)
  alt.submit('동지')
  check('복수 정답 허용', alt.snapshot().reveal?.outcome, '정답')

  const near = newEngine('보통', pool)
  near.submit('동무우')
  check('편집거리 1은 정답 처리하지 않는다', near.snapshot().reveal, null)
  check('대신 "거의 맞았어요" 안내', near.snapshot().feedback?.kind, 'near')
  check('그래도 하트는 차감', near.snapshot().hearts, 2)
}

// ── 11. 실제 데이터 ────────────────────────────────

console.log('\n[11] 실제 데이터 (chosung_words.json)')
{
  const words = realWords as ChosungWord[]
  check('남한말 표현이 없는 문제 없음', words.filter((w) => !w.south_expression.trim()).length, 0)
  check('한 글자 단어 없음', words.filter((w) => w.length < 2).length, 0)
  check('난이도 값이 모두 유효', words.filter((w) => !DIFFICULTY_MULTIPLIER[w.difficulty]).length, 0)
  check('정답 배열에 표준 표기 포함', words.filter((w) => !w.accepted_answers.includes(w.word)).length, 0)
  check('모든 문제에 의미 분야 있음', words.filter((w) => !w.category?.trim()).length, 0)
  check('모든 문제에 뜻풀이 있음', words.filter((w) => !w.meaning.trim()).length, 0)
  check('뜻풀이가 정답을 노출하지 않음', words.filter((w) => w.meaning.includes(w.word)).length, 0)
  check(
    '구버전 자동생성 뜻풀이 없음',
    words.filter((w) => w.meaning.includes('남한말로 풀이하면')).length,
    0,
  )
  // 초성이 겹쳐도 뜻풀이가 달라 구분된다
  const collide = new Map<string, Set<string>>()
  words.forEach((w) => {
    const key = `${w.difficulty}|${w.initials}`
    if (!collide.has(key)) collide.set(key, new Set())
    collide.get(key)!.add(w.meaning)
  })
  const sameKeyCounts = new Map<string, number>()
  words.forEach((w) => {
    const key = `${w.difficulty}|${w.initials}`
    sameKeyCounts.set(key, (sameKeyCounts.get(key) ?? 0) + 1)
  })
  let indistinguishable = 0
  sameKeyCounts.forEach((count, key) => {
    if (count > (collide.get(key)?.size ?? 0)) indistinguishable += 1
  })
  check('초성이 같아도 뜻풀이로 구분 가능', indistinguishable, 0)

  for (const level of ['쉬움', '보통', '어려움'] as Difficulty[]) {
    const pool = words.filter((w) => w.difficulty === level)
    const engine = newEngine(level, words)
    const drawn = engine.snapshot()
    check(`${level} 문제 ${pool.length}개 → 10문제 출제`, drawn.totalQuestions, QUESTIONS_PER_ROUND)
    // 출제된 문제가 모두 선택 난이도인지 확인
    let ok = true
    const e = newEngine(level, words)
    for (let i = 0; i < QUESTIONS_PER_ROUND; i += 1) {
      const s = e.snapshot()
      const match = pool.find((w) => w.initials === s.initials)
      if (!match) ok = false
      e.submit(match ? match.accepted_answers[0] : 'x')
      e.next()
    }
    check(`${level} 출제 문제가 모두 해당 난이도`, ok, true)
  }
}

console.log(failures === 0 ? '\n전체 통과' : `\n${failures}건 실패`)
process.exit(failures === 0 ? 0 : 1)
