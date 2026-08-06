/** 초성게임 엔진 — 상세기획서 3장
 *
 * 산성비게임과 같은 방식으로 requestAnimationFrame + delta time을 쓴다.
 * 화면 갱신 주기와 무관하게 제한시간이 정확히 흐르고, 가상 시계로 테스트할 수 있다. */

import type { ChosungQuestionLog, ChosungResult, ChosungWord, Difficulty } from '../lib/types'
import {
  DIFFICULTY_MULTIPLIER,
  HINT_SCORE,
  MAX_HINT_LEVEL,
  MAX_WRONG,
  QUESTIONS_PER_ROUND,
  TIME_LIMIT_SECONDS,
  comboBonus,
  isSubmittable,
  normalizeAnswer,
  revealFirstLetter,
} from './chosungConfig'

export interface RevealState {
  outcome: '정답' | '오답' | '시간 초과'
  word: string
  meaning: string
  southExpression: string
  earned: number
  comboBonus: number
}

export interface ChosungSnapshot {
  status: 'ready' | 'playing' | 'paused' | 'over' | 'error'
  /** 1부터 시작하는 표시용 문제 번호 */
  questionNumber: number
  totalQuestions: number
  initials: string
  /** 기본 정보로 항상 노출하는 뜻풀이 */
  meaning: string
  wordLength: number
  remainingSeconds: number
  /** 타이머 바 진행률 0~1 */
  timeProgress: number
  hearts: number
  hintLevel: number
  maxHintLevel: number
  /** 1단계 힌트로 공개된 남한말 표현. 아직 안 열었으면 null */
  southHint: string | null
  score: number
  combo: number
  maxCombo: number
  reveal: RevealState | null
  feedback: { id: number; kind: 'wrong' | 'near' | 'ignored'; message: string } | null
}

type Listener = (snapshot: ChosungSnapshot) => void

/** 편집거리 1이면 "거의 맞았어요" 안내만 한다. 정답 처리하지 않는다(FR-CH-11). */
function isNearMiss(input: string, answer: string): boolean {
  if (Math.abs(input.length - answer.length) > 1) return false
  if (input === answer) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < input.length && j < answer.length) {
    if (input[i] === answer[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (input.length > answer.length) i += 1
    else if (input.length < answer.length) j += 1
    else {
      i += 1
      j += 1
    }
  }
  return edits + (input.length - i) + (answer.length - j) <= 1
}

export class ChosungEngine {
  private readonly questions: ChosungWord[]
  private readonly difficulty: Difficulty

  private listeners = new Set<Listener>()
  private rafId: number | null = null
  private lastFrame = 0

  private index = 0
  private remaining = TIME_LIMIT_SECONDS
  private wrongCount = 0
  private hintLevel = 0

  private rawScore = 0
  private combo = 0
  private maxCombo = 0
  private correctCount = 0
  private noHintCorrectCount = 0
  private hintsUsed = 0
  private playTime = 0

  private reveal: RevealState | null = null

  private feedbackSeq = 1
  private feedback: ChosungSnapshot['feedback'] = null
  private feedbackTimer = 0

  private status: ChosungSnapshot['status'] = 'ready'
  private logs: ChosungQuestionLog[] = []

  constructor(pool: ChosungWord[], difficulty: Difficulty) {
    this.difficulty = difficulty
    this.questions = ChosungEngine.pickQuestions(pool, difficulty)
    if (this.questions.length === 0) this.status = 'error'
  }

  /** 선택 난이도의 문제 중 중복 없이 무작위로 10문제 (FR-CH-01) */
  private static pickQuestions(pool: ChosungWord[], difficulty: Difficulty): ChosungWord[] {
    const candidates = pool.filter(
      (word) => word.difficulty === difficulty && word.south_expression.trim().length > 0,
    )
    const shuffled = [...candidates]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, QUESTIONS_PER_ROUND)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  private get current(): ChosungWord | null {
    return this.questions[this.index] ?? null
  }

  snapshot(): ChosungSnapshot {
    const word = this.current
    const revealed = this.hintLevel >= 1
    return {
      status: this.status,
      questionNumber: Math.min(this.index + 1, this.questions.length),
      totalQuestions: this.questions.length,
      initials: word
        ? this.hintLevel >= 2
          ? revealFirstLetter(word.initials, word.first_letter)
          : word.initials
        : '',
      // 뜻풀이는 기본 정보라 항상 그대로 보여준다 (FR-CH-03)
      meaning: word?.meaning ?? '',
      wordLength: word?.length ?? 0,
      remainingSeconds: Math.max(0, Math.ceil(this.remaining)),
      timeProgress: Math.max(0, Math.min(1, this.remaining / TIME_LIMIT_SECONDS)),
      hearts: Math.max(0, MAX_WRONG - this.wrongCount),
      hintLevel: this.hintLevel,
      maxHintLevel: MAX_HINT_LEVEL,
      southHint: word && revealed ? word.south_expression : null,
      score: this.rawScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      reveal: this.reveal,
      feedback: this.feedback,
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  start(): void {
    if (this.questions.length === 0) {
      this.status = 'error'
      this.stopLoop()
      this.emit()
      return
    }
    if (this.status === 'playing') return
    this.status = 'playing'
    this.lastFrame = performance.now()
    this.loop(this.lastFrame)
    this.emit()
  }

  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
    this.stopLoop()
    this.emit()
  }

  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
    this.lastFrame = performance.now()
    this.loop(this.lastFrame)
    this.emit()
  }

  destroy(): void {
    this.stopLoop()
    this.listeners.clear()
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private loop = (now: number): void => {
    if (this.status !== 'playing') return
    const delta = Math.min(0.1, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.tick(delta)
    this.rafId = requestAnimationFrame(this.loop)
  }

  private tick(delta: number): void {
    this.playTime += delta

    if (this.feedback) {
      this.feedbackTimer -= delta
      if (this.feedbackTimer <= 0) this.feedback = null
    }

    // 정답 공개 중에는 제한시간이 흐르지 않으며, 사용자가 직접 다음 문제로 진행한다.
    if (this.reveal) {
      this.emit()
      return
    }

    this.remaining -= delta
    if (this.remaining <= 0) {
      this.remaining = 0
      this.timeOut()
    }
    this.emit()
  }

  /** 20초 초과 — 0점 처리, 콤보 초기화, 정답 공개 (FR-CH-07) */
  private timeOut(): void {
    const word = this.current
    if (!word) return
    this.combo = 0
    this.log(word, '시간 초과', 0)
    this.openReveal('시간 초과', word, 0, 0)
  }

  private log(
    word: ChosungWord,
    outcome: ChosungQuestionLog['outcome'],
    earned: number,
  ): void {
    this.logs.push({
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      southExpression: word.south_expression,
      initials: word.initials,
      hintsUsed: this.hintLevel,
      wrongCount: this.wrongCount,
      earned,
      outcome,
    })
  }

  private openReveal(
    outcome: RevealState['outcome'],
    word: ChosungWord,
    earned: number,
    bonus: number,
  ): void {
    this.reveal = {
      outcome,
      word: word.word,
      meaning: word.meaning,
      southExpression: word.south_expression,
      earned,
      comboBonus: bonus,
    }
  }

  private showFeedback(kind: 'wrong' | 'near' | 'ignored', message: string): void {
    this.feedback = { id: this.feedbackSeq++, kind, message }
    this.feedbackTimer = 1.2
  }

  /** 힌트 열람 — 반드시 1단계부터 순서대로, 콤보는 즉시 초기화 (FR-CH-04·08) */
  useHint(): void {
    if (this.status !== 'playing' || this.reveal) return
    if (this.hintLevel >= MAX_HINT_LEVEL) return
    this.hintLevel += 1
    this.hintsUsed += 1
    this.combo = 0
    this.emit()
  }

  submit(raw: string): void {
    if (this.status !== 'playing' || this.reveal) return
    const word = this.current
    if (!word) return

    // 빈 값·공백·특수문자만 있는 입력은 기회를 깎지 않는다 (FR-CM-07)
    if (!isSubmittable(raw)) {
      this.showFeedback('ignored', '정답을 입력해 주세요')
      this.emit()
      return
    }

    const input = normalizeAnswer(raw)
    const accepted = word.accepted_answers.map(normalizeAnswer)

    if (accepted.includes(input)) {
      const base = HINT_SCORE[Math.min(this.hintLevel, HINT_SCORE.length - 1)]
      const clean = this.hintLevel === 0 && this.wrongCount === 0
      if (clean) {
        this.combo += 1
        this.maxCombo = Math.max(this.maxCombo, this.combo)
        this.noHintCorrectCount += 1
      } else {
        this.combo = 0
      }
      const bonus = clean ? comboBonus(this.combo) : 0
      this.rawScore += base + bonus
      this.correctCount += 1
      this.log(word, '정답', base + bonus)
      this.openReveal('정답', word, base, bonus)
      this.emit()
      return
    }

    // 오답 — 하트 차감, 콤보 초기화 (FR-CH-06·08)
    this.wrongCount += 1
    this.combo = 0

    if (this.wrongCount >= MAX_WRONG) {
      this.log(word, '오답', 0)
      this.openReveal('오답', word, 0, 0)
      this.emit()
      return
    }

    // 편집거리 1은 정답으로 인정하지 않고 안내만 한다 (FR-CH-11)
    const near = accepted.some((answer) => isNearMiss(input, answer))
    this.showFeedback(near ? 'near' : 'wrong', near ? '거의 맞았어요!' : '다시 시도해 보세요')
    this.emit()
  }

  /** 정답 공개 화면에서 사용자가 선택하면 다음 문제로 이동 */
  next(): void {
    if (!this.reveal) return
    this.reveal = null
    this.index += 1
    this.remaining = TIME_LIMIT_SECONDS
    this.wrongCount = 0
    this.hintLevel = 0
    this.feedback = null

    if (this.index >= this.questions.length) {
      this.status = 'over'
      this.stopLoop()
    }
    this.emit()
  }

  /** 총점 = (기본점수 + 콤보 보너스) 합계 × 난이도 배수, 반올림 (FR-CH-10) */
  buildResult(): ChosungResult {
    const multiplier = DIFFICULTY_MULTIPLIER[this.difficulty]
    return {
      game: 'chosung',
      difficulty: this.difficulty,
      rawScore: this.rawScore,
      multiplier,
      score: Math.round(this.rawScore * multiplier),
      correctCount: this.correctCount,
      noHintCorrectCount: this.noHintCorrectCount,
      maxCombo: this.maxCombo,
      hintsUsed: this.hintsUsed,
      playTimeSeconds: Math.round(this.playTime),
      questions: this.logs,
    }
  }
}
