/** API 명세서 B·C장의 계약을 그대로 옮긴 타입 정의 */

/* 난이도. */
export type Difficulty = '쉬움' | '보통' | '어려움'
export type GameId = 'chosung' | 'acid_rain'

export const DIFFICULTIES: Difficulty[] = ['쉬움', '보통', '어려움']

/** 이전 버전의 URL·로컬 기록을 새 난이도 이름으로 안전하게 변환한다. */
export function normalizeDifficulty(value: unknown): Difficulty | null {
  if (value === '쉬움' || value === '이지') return '쉬움'
  if (value === '보통' || value === '노멀') return '보통'
  if (value === '어려움' || value === '하드') return '어려움'
  return null
}

/** B-1. 초성게임 데이터 — chosung_words.json */
export interface ChosungWord {
  id: string
  word: string
  accepted_answers: string[]
  meaning: string
  south_expression: string
  initials: string
  first_letter: string
  length: number
  difficulty: Difficulty
  /* 의미 분야. */
  category?: string
}

/** B-2. 산성비게임 데이터 — acidrain_pairs.json */
export interface AcidRainPair {
  id: string
  north: string
  south: string
  north_answers: string[]
  south_answers: string[]
  similarity?: '낮음' | '보통' | '높음'
  category?: string
  difficulty: Difficulty
}

/** C-1. 점수 등록 요청 본문 */
export interface ChosungScorePayload {
  nickname: string
  game: 'chosung'
  difficulty: Difficulty
  score: number
  correct_count: number
  no_hint_correct_count: number
  max_combo: number
}

export interface AcidRainScorePayload {
  nickname: string
  game: 'acid_rain'
  difficulty: Difficulty
  score: number
  correct_count: number
  stage_reached: number
  max_combo: number
  time_stop_uses: number
  time_stop_clears: number
  play_time_seconds: number
}

export type ScorePayload = ChosungScorePayload | AcidRainScorePayload

/** C-1. 점수 등록 응답 */
export interface ScoreSubmitResult {
  score_id: string
  rank: number
  total_players: number
}

/** C-2. TOP 5 랭킹 조회 응답 */
export interface RankingEntry {
  rank: number
  nickname: string
  score: number
  played_at: string
  stage_reached?: number
}

export interface RankingResponse {
  game: GameId
  difficulty: Difficulty
  top5: RankingEntry[]
}

/** 내 최근 기록 조회 응답 — nickname이 아닌 player_key 기준(API 명세서 06_API_DB매핑) */
export interface RecentRecordEntry {
  score_id: string
  nickname: string
  score: number
  played_at: string
  stage_reached?: number
}

export interface RecentRecordsResponse {
  game: GameId
  difficulty: Difficulty
  records: RecentRecordEntry[]
}

/** 관리자 통계 화면 응답 — GET /api/v1/admin/stats(비밀번호 헤더 필요) */
export interface StatsResponse {
  total_page_views: number
  total_game_starts: number
  unique_visitors: number
  game_starts_by_game: {
    chosung: number
    acid_rain: number
  }
  /** 같은 브라우저에서 여러 판 시작해도 한 명으로 센 순 이용자 수 */
  unique_players: number
  /** 방문자 중 실제로 게임을 시작한 비율(%). 방문자가 아직 없으면 null */
  usage_rate_percent: number | null
  /** 게임 이용자 한 명이 평균적으로 게임을 시작한 횟수 */
  average_game_starts_per_player: number | null
}

/** 산성비게임 결과 화면에 넘기는 플레이 요약 */
export interface AcidRainResult {
  game: 'acid_rain'
  difficulty: Difficulty
  score: number
  stageReached: number
  maxCombo: number
  correctCount: number
  timeStopUses: number
  timeStopClears: number
  playTimeSeconds: number
  missed: MissedWord[]
}

export function isAcidRainResult(value: unknown): value is AcidRainResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<AcidRainResult>
  return (
    result.game === 'acid_rain' &&
    DIFFICULTIES.includes(result.difficulty as Difficulty) &&
    Number.isSafeInteger(result.score) &&
    Number.isSafeInteger(result.stageReached) &&
    Number.isSafeInteger(result.maxCombo) &&
    Number.isSafeInteger(result.correctCount) &&
    Number.isSafeInteger(result.timeStopUses) &&
    Number.isSafeInteger(result.timeStopClears) &&
    Number.isSafeInteger(result.playTimeSeconds) &&
    Number(result.score) >= 0 &&
    Number(result.stageReached) >= 1 &&
    Number(result.maxCombo) >= 0 &&
    Number(result.correctCount) >= 0 &&
    Number(result.timeStopUses) >= 0 &&
    Number(result.timeStopClears) >= 0 &&
    Number(result.playTimeSeconds) >= 0 &&
    Array.isArray(result.missed) &&
    result.missed.every((word) =>
      typeof word === 'object' &&
      word !== null &&
      typeof word.id === 'string' &&
      typeof word.prompt === 'string' &&
      typeof word.answer === 'string' &&
      (word.promptSide === 'north' || word.promptSide === 'south') &&
      (word.reason === '놓침' || word.reason === '시간 초과'),
    )
  )
}

/** 초성게임 결과 화면에 넘기는 문제별 기록 */
export interface ChosungQuestionLog {
  id: string
  word: string
  meaning: string
  southExpression: string
  initials: string
  hintsUsed: number
  wrongCount: number
  earned: number
  outcome: '정답' | '오답' | '시간 초과'
}

export interface ChosungResult {
  game: 'chosung'
  difficulty: Difficulty
  /** 난이도 배수까지 적용한 최종 점수 */
  score: number
  /** 배수 적용 전 합계 — 결과 화면에서 계산 과정을 보여줄 때 쓴다 */
  rawScore: number
  multiplier: number
  correctCount: number
  noHintCorrectCount: number
  maxCombo: number
  hintsUsed: number
  playTimeSeconds: number
  questions: ChosungQuestionLog[]
}

export function isChosungResult(value: unknown): value is ChosungResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<ChosungResult>
  return (
    result.game === 'chosung' &&
    DIFFICULTIES.includes(result.difficulty as Difficulty) &&
    Number.isSafeInteger(result.score) &&
    Number.isSafeInteger(result.rawScore) &&
    Number.isSafeInteger(result.correctCount) &&
    Number.isSafeInteger(result.noHintCorrectCount) &&
    Number.isSafeInteger(result.maxCombo) &&
    Number.isSafeInteger(result.hintsUsed) &&
    Number.isSafeInteger(result.playTimeSeconds) &&
    typeof result.multiplier === 'number' &&
    Number(result.score) >= 0 &&
    Number(result.rawScore) >= 0 &&
    Number(result.correctCount) >= 0 &&
    Number(result.noHintCorrectCount) >= 0 &&
    Number(result.maxCombo) >= 0 &&
    Number(result.hintsUsed) >= 0 &&
    Number(result.playTimeSeconds) >= 0 &&
    Array.isArray(result.questions) &&
    result.questions.every(
      (log) =>
        typeof log === 'object' &&
        log !== null &&
        typeof log.id === 'string' &&
        typeof log.word === 'string' &&
        typeof log.initials === 'string' &&
        (log.outcome === '정답' || log.outcome === '오답' || log.outcome === '시간 초과'),
    )
  )
}

export interface MissedWord {
  id: string
  prompt: string
  answer: string
  /** 제시된 단어가 북한말이었는지 남한말이었는지 */
  promptSide: 'north' | 'south'
  reason: '놓침' | '시간 초과'
}
