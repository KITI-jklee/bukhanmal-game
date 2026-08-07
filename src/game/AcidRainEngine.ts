/** 산성비게임 엔진 — 상세기획서 4장
 *
 * React 밖에서 게임 루프를 돌리고 변경 시에만 구독자에게 알린다.
 * 낙하 위치는 픽셀이 아니라 진행률(0~1)로 관리하므로 화면 크기가 바뀌거나
 * 모바일 가상 키보드가 열려도 단어가 순간 이동하지 않는다(NFR-03). */

import type { AcidRainPair, AcidRainResult, Difficulty, MissedWord } from '../lib/types'
import { isCorrect, isSubmittable, normalize } from '../lib/answer'
import {
  BASE_SCORE,
  DEFENSE_LOSS_PER_MISS,
  DEFENSE_MAX,
  MAX_MISSES,
  NORTH_PROMPT_RATIO,
  STAGE3_FALL_STEP,
  STAGE3_MIN_FALL,
  STAGE3_MIN_SPAWN,
  STAGE3_SPAWN_STEP,
  STAGE3_SPEEDUP_EVERY,
  STAGES,
  TIME_STOP_DURATION,
  TIME_STOP_WORD,
  comboMultiplier,
} from './acidRainConfig'

export interface FallingWord {
  key: number
  pairId: string
  /** 화면에 표시되는 단어 */
  prompt: string
  /** 제시어가 북한말인지 남한말인지 — 색상 결정 */
  promptSide: 'north' | 'south'
  /** 사용자가 입력해야 하는 허용 정답 배열 */
  answers: string[]
  /** 정답 표준 표기(결과 화면 복습 노트용) */
  answerLabel: string
  isTimeStop: boolean
  /** 0(최상단) ~ 1(바닥) */
  progress: number
  /** 낙하에 걸리는 총 시간(초) */
  fallDuration: number
  /** 가로 위치 퍼센트 */
  x: number
}

export interface EngineSnapshot {
  words: FallingWord[]
  score: number
  combo: number
  maxCombo: number
  multiplier: number
  stage: number
  /** 현재 스테이지 내 일반 단어 정답 수 */
  stageCorrect: number
  stageTarget: number | null
  defense: number
  timeStopRemaining: number
  isTimeStopped: boolean
  status: 'ready' | 'playing' | 'paused' | 'stage-clear' | 'over' | 'error'
  /** 스테이지 전환 배너에 띄울 다음 스테이지 번호 */
  bannerStage: number | null
  feedback: Feedback | null
}

export interface Feedback {
  id: number
  kind: 'correct' | 'wrong' | 'miss' | 'time-stop'
  message: string
}

type Listener = (snapshot: EngineSnapshot) => void

const STAGE_BANNER_DURATION = 1.1

export class AcidRainEngine {
  private readonly pool: AcidRainPair[]
  private readonly difficulty: Difficulty
  private readonly fallDurationScale: number

  private words: FallingWord[] = []
  private listeners = new Set<Listener>()

  private rafId: number | null = null
  private lastFrame = 0

  private nextKey = 1
  private feedbackSeq = 1
  private feedback: Feedback | null = null
  private feedbackTimer = 0

  private stageIndex = 0
  private stageCorrect = 0
  private spawnTimer = 0
  private bannerTimer = 0
  private bannerStage: number | null = null

  private score = 0
  private combo = 0
  private maxCombo = 0
  private misses = 0
  private correctCount = 0
  private timeStopUses = 0
  private timeStopClears = 0
  private playTime = 0
  private renderTimer = 0

  private timeStopRemaining = 0
  /** 현재 스테이지에서 시간정지 단어를 몇 번 내보냈는지 */
  private timeStopSpawned = 0
  private pendingTimeStop = false

  private status: EngineSnapshot['status'] = 'ready'
  private missed: MissedWord[] = []
  /** 최근 출제 pair를 기억해 같은 단어가 연달아 나오지 않게 한다 */
  private recentPairIds: string[] = []

  constructor(pairs: AcidRainPair[], difficulty: Difficulty, fallDurationScale = 1) {
    this.difficulty = difficulty
    this.fallDurationScale = fallDurationScale
    this.pool = pairs.filter((pair) => pair.difficulty === difficulty)
    if (this.pool.length === 0) this.status = 'error'
  }

  // ── 구독 ─────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  snapshot(): EngineSnapshot {
    const stage = STAGES[this.stageIndex]
    return {
      words: this.words,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: comboMultiplier(this.combo),
      stage: stage.stage,
      stageCorrect: this.stageCorrect,
      stageTarget: stage.target,
      defense: this.defensePercent(),
      timeStopRemaining: this.timeStopRemaining,
      isTimeStopped: this.timeStopRemaining > 0,
      status: this.status,
      bannerStage: this.bannerStage,
      feedback: this.feedback,
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private emitFrame(): void {
    if (this.renderTimer < 1 / 30) return
    this.renderTimer = 0
    this.emit()
  }

  private defensePercent(): number {
    if (this.misses >= MAX_MISSES) return 0
    return Math.max(0, DEFENSE_MAX - this.misses * DEFENSE_LOSS_PER_MISS)
  }

  // ── 수명주기 ─────────────────────────────────────

  start(): void {
    if (this.pool.length === 0) {
      this.status = 'error'
      this.stopLoop()
      this.emit()
      return
    }
    if (this.status === 'playing') return
    this.status = 'playing'
    // 첫 단어는 대기 없이 바로 떨어지게 한다
    this.spawnTimer = 0
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
    this.rafId = requestAnimationFrame(this.loop)
    // 탭 복귀 등으로 프레임 간격이 벌어져도 한 번에 순간 이동하지 않도록 상한을 둔다
    const delta = Math.min((now - this.lastFrame) / 1000, 0.1)
    this.lastFrame = now
    if (delta <= 0) return
    this.tick(delta)
  }

  // ── 게임 루프 ────────────────────────────────────

  private tick(delta: number): void {
    if (this.status !== 'playing') return
    this.playTime += delta
    this.renderTimer += delta

    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= delta
      if (this.feedbackTimer <= 0) this.feedback = null
    }

    // 스테이지 전환 배너 표시 중에는 낙하·생성을 모두 멈춘다
    if (this.bannerStage !== null) {
      this.bannerTimer -= delta
      if (this.bannerTimer <= 0) {
        this.bannerStage = null
        // 배너가 걷히면 곧바로 다음 스테이지 첫 단어가 나오게 한다
        this.spawnTimer = 0
      }
      this.emitFrame()
      return
    }

    if (this.timeStopRemaining > 0) {
      this.timeStopRemaining = Math.max(0, this.timeStopRemaining - delta)
      // 멈춘 일반 단어를 모두 제거하면 남은 시간이 있어도 즉시 재개 (4-5)
      if (this.timeStopRemaining === 0 || !this.words.some((word) => !word.isTimeStop)) {
        this.timeStopRemaining = 0
      }
      this.emitFrame()
      return
    }

    this.advanceWords(delta)
    if (this.status !== 'playing') return

    this.spawnTimer -= delta
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.currentSpawnInterval()
      this.trySpawn()
    }

    this.emitFrame()
  }

  private advanceWords(delta: number): void {
    const survivors: FallingWord[] = []

    for (const word of this.words) {
      const next = word.progress + delta / word.fallDuration
      if (next < 1) {
        survivors.push({ ...word, progress: next })
        continue
      }

      // 바닥 도달 — 시간정지 단어는 불이익 없이 사라진다 (4-7)
      if (word.isTimeStop) continue

      this.misses += 1
      this.combo = 0
      this.missed.push({
        id: word.pairId,
        prompt: word.prompt,
        answer: word.answerLabel,
        promptSide: word.promptSide,
        reason: '놓침',
      })
      this.setFeedback('miss', `놓쳤어요 · ${word.prompt} → ${word.answerLabel}`)
    }

    this.words = survivors

    if (this.misses >= MAX_MISSES) {
      this.finish()
    }
  }

  private finish(): void {
    this.status = 'over'
    this.stopLoop()
    this.words = []
    this.emit()
  }

  // ── 스테이지 ─────────────────────────────────────

  private get stageConfig() {
    return STAGES[this.stageIndex]
  }

  /** 3단계 가속을 반영한 현재 낙하시간 */
  private currentFallDuration(): number {
    const config = this.stageConfig
    if (config.stage !== 3) return config.fallDuration * this.fallDurationScale
    const steps = Math.floor(this.stageCorrect / STAGE3_SPEEDUP_EVERY)
    return (
      Math.max(STAGE3_MIN_FALL, config.fallDuration - steps * STAGE3_FALL_STEP) *
      this.fallDurationScale
    )
  }

  private currentSpawnInterval(): number {
    const config = this.stageConfig
    if (config.stage !== 3) return config.spawnInterval
    const steps = Math.floor(this.stageCorrect / STAGE3_SPEEDUP_EVERY)
    return Math.max(STAGE3_MIN_SPAWN, config.spawnInterval - steps * STAGE3_SPAWN_STEP)
  }

  private checkStageClear(): void {
    const config = this.stageConfig
    if (config.target === null || this.stageCorrect < config.target) return
    if (this.stageIndex >= STAGES.length - 1) return

    // 신규 스폰을 멈추고 화면의 잔여 일반 단어를 정리한 뒤 다음 단계로 (4-3)
    this.words = []
    this.stageIndex += 1
    this.stageCorrect = 0
    this.timeStopSpawned = 0
    this.pendingTimeStop = false
    this.bannerStage = this.stageConfig.stage
    this.bannerTimer = STAGE_BANNER_DURATION
  }

  // ── 단어 생성 ────────────────────────────────────

  private trySpawn(): void {
    if (this.words.length >= this.stageConfig.maxConcurrent) return

    if (this.pendingTimeStop && !this.words.some((word) => word.isTimeStop)) {
      this.pendingTimeStop = false
      this.timeStopSpawned += 1
      this.words = [...this.words, this.makeTimeStopWord()]
      return
    }

    const word = this.makeNormalWord()
    if (word) this.words = [...this.words, word]
  }

  private makeTimeStopWord(): FallingWord {
    return {
      key: this.nextKey++,
      pairId: `time-stop-${this.nextKey}`,
      prompt: TIME_STOP_WORD,
      promptSide: 'north',
      answers: [TIME_STOP_WORD],
      answerLabel: TIME_STOP_WORD,
      isTimeStop: true,
      progress: 0,
      fallDuration: this.currentFallDuration(),
      x: this.pickX(),
    }
  }

  private makeNormalWord(): FallingWord | null {
    const pair = this.pickPair()
    if (!pair) return null

    // 북한말 제시 60% / 남한말 제시 40% (4-1)
    const showNorth = Math.random() < NORTH_PROMPT_RATIO

    return {
      key: this.nextKey++,
      pairId: pair.id,
      prompt: showNorth ? pair.north : pair.south,
      promptSide: showNorth ? 'north' : 'south',
      answers: showNorth ? pair.south_answers : pair.north_answers,
      answerLabel: showNorth ? pair.south : pair.north,
      isTimeStop: false,
      progress: 0,
      fallDuration: this.currentFallDuration(),
      x: this.pickX(),
    }
  }

  /** 화면에 있는 단어와 정답이 겹치지 않는 pair를 고른다 (4-6) */
  private pickPair(): AcidRainPair | null {
    if (this.pool.length === 0) return null

    const onScreen = new Set(this.words.map((word) => word.pairId))
    const onScreenAnswers = new Set(
      this.words.flatMap((word) => word.answers.map((answer) => normalize(answer))),
    )
    const recent = new Set(this.recentPairIds)

    const usable = this.pool.filter((pair) => {
      if (onScreen.has(pair.id)) return false
      const answers = [...pair.north_answers, ...pair.south_answers].map(normalize)
      return !answers.some((answer) => onScreenAnswers.has(answer))
    })
    if (usable.length === 0) return null

    // 직전 출제분을 우선 제외하되, 남는 게 없으면 중복을 허용해 스폰이 멈추지 않게 한다
    const fresh = usable.filter((pair) => !recent.has(pair.id))
    const candidates = fresh.length > 0 ? fresh : usable

    const pair = candidates[Math.floor(Math.random() * candidates.length)]
    this.recentPairIds = [...this.recentPairIds, pair.id].slice(-Math.min(40, this.pool.length - 5))
    return pair
  }

  /** 기존 단어와 가로로 겹치지 않는 위치를 고른다 */
  private pickX(): number {
    const taken = this.words.filter((word) => word.progress < 0.35).map((word) => word.x)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const x = 4 + Math.random() * 62
      if (taken.every((used) => Math.abs(used - x) > 18)) return x
    }
    return 4 + Math.random() * 62
  }

  // ── 입력 판정 ────────────────────────────────────

  submit(rawInput: string): void {
    if (this.status !== 'playing' || this.bannerStage !== null) return
    // 빈 문자열·공백·특수문자만 있는 값은 오답으로도 처리하지 않는다 (FR-CM-07)
    if (!isSubmittable(rawInput)) return

    // 같은 정답이 여러 개면 바닥에 가장 가까운 단어부터 제거 (FR-AR-14)
    const matches = this.words
      .filter((word) => isCorrect(rawInput, word.answers))
      .sort((a, b) => b.progress - a.progress)

    const hit = matches[0]
    if (!hit) {
      this.combo = 0
      this.setFeedback('wrong', '아쉬워요, 다시 입력해 보세요')
      this.emit()
      return
    }

    this.words = this.words.filter((word) => word.key !== hit.key)

    if (hit.isTimeStop) {
      // 시간정지 단어는 점수·콤보·스테이지 정답 수에 포함하지 않는다 (FR-AR-13)
      this.timeStopRemaining = TIME_STOP_DURATION
      this.timeStopUses += 1
      this.setFeedback('time-stop', '시간 정지! 5초 동안 멈춥니다')
      this.emit()
      return
    }

    this.registerCorrect()
    this.emit()
  }

  private registerCorrect(): void {
    // 콤보를 먼저 올린 뒤 배수를 적용해 "해당 정답부터" 새 배수가 걸리게 한다 (4-4)
    this.combo += 1
    this.maxCombo = Math.max(this.maxCombo, this.combo)

    const multiplier = comboMultiplier(this.combo)
    const gained = (BASE_SCORE[this.difficulty] + this.stageConfig.bonus) * multiplier
    this.score += gained

    this.correctCount += 1
    this.stageCorrect += 1
    if (this.timeStopRemaining > 0) this.timeStopClears += 1

    this.setFeedback('correct', `+${gained}${multiplier > 1 ? ` ×${multiplier}` : ''}`)

    this.queueTimeStopIfDue()
    this.checkStageClear()
  }

  /** 스테이지별 출현 기준을 넘겼으면 다음 스폰에 시간정지 단어를 예약한다 (4-5) */
  private queueTimeStopIfDue(): void {
    const config = this.stageConfig
    if (config.timeStopLimit !== null && this.timeStopSpawned >= config.timeStopLimit) return
    if (this.stageCorrect === 0 || this.stageCorrect % config.timeStopEvery !== 0) return
    if (this.words.some((word) => word.isTimeStop)) return
    this.pendingTimeStop = true
  }

  private setFeedback(kind: Feedback['kind'], message: string): void {
    this.feedback = { id: this.feedbackSeq++, kind, message }
    this.feedbackTimer = 1.2
  }

  // ── 결과 ─────────────────────────────────────────

  buildResult(): AcidRainResult {
    return {
      game: 'acid_rain',
      difficulty: this.difficulty,
      score: this.score,
      stageReached: this.stageConfig.stage,
      maxCombo: this.maxCombo,
      correctCount: this.correctCount,
      timeStopUses: this.timeStopUses,
      timeStopClears: this.timeStopClears,
      playTimeSeconds: Math.round(this.playTime),
      missed: this.missed,
    }
  }
}
