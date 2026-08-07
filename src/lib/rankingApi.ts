/** 랭킹 API 클라이언트 — API 명세서 C장
 *
 * VITE_API_BASE_URL이 설정되어 있으면 실제 FastAPI 백엔드(game_scores
 * 테이블, Supabase)를 호출한다. 그렇지 않을 때만(로컬 데모 등) localStorage
 * 기반 목업으로 동작한다 — USE_MOCK 판단 로직 참고. */

import type {
  Difficulty,
  GameId,
  RankingEntry,
  RankingResponse,
  RecentRecordEntry,
  RecentRecordsResponse,
  ScorePayload,
  ScoreSubmitResult,
} from './types'
import { normalizeDifficulty } from './types'
import { getPlayerKey, readJson, writeJson } from './storage'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL)

if (import.meta.env.PROD && USE_MOCK) {
  console.warn('운영 빌드가 명시적인 목업 모드로 실행됩니다.')
}

/* v4: 시연용 가짜 랭킹을 제거했다. 기존 저장 키와 분리해 브라우저에 남아 있던
 * 시드 기록이 새 랭킹에 섞이지 않게 한다. */
const STORE_KEY = 'tongil.scores.v4'
const MAX_SCORE = 10_000_000
const REQUEST_TIMEOUT_MS = 10_000

interface StoredScore {
  id: string
  nickname: string
  game: GameId
  difficulty: Difficulty
  score: number
  stage_reached?: number
  played_at: string
}

function loadStore(): StoredScore[] {
  const stored = readJson<unknown>(STORE_KEY, [])
  if (Array.isArray(stored)) {
    const migrated = stored.map((value) => {
      if (typeof value !== 'object' || value === null) return value
      const row = value as Record<string, unknown>
      const difficulty = normalizeDifficulty(row.difficulty)
      return difficulty ? { ...row, difficulty } : value
    })
    const valid = migrated.filter(isStoredScore)
    if (JSON.stringify(valid) !== JSON.stringify(stored)) writeJson(STORE_KEY, valid)
    return valid
  }
  writeJson(STORE_KEY, [])
  return []
}

function isStoredScore(value: unknown): value is StoredScore {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Partial<StoredScore>
  return (
    typeof row.id === 'string' &&
    typeof row.nickname === 'string' &&
    (row.game === 'acid_rain' || row.game === 'chosung') &&
    normalizeDifficulty(row.difficulty) !== null &&
    typeof row.score === 'number' &&
    Number.isSafeInteger(row.score) &&
    row.score >= 0 &&
    row.score <= MAX_SCORE &&
    typeof row.played_at === 'string' &&
    !Number.isNaN(Date.parse(row.played_at))
  )
}

function assertValidScorePayload(payload: ScorePayload): void {
  if (!Number.isSafeInteger(payload.score) || payload.score < 0 || payload.score > MAX_SCORE) {
    throw new Error('유효하지 않은 점수입니다.')
  }
  if (payload.nickname.length < 1 || payload.nickname.length > 10) {
    throw new Error('유효하지 않은 닉네임입니다.')
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('서버 응답 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

function isSubmitResult(value: unknown): value is ScoreSubmitResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<ScoreSubmitResult>
  return (
    typeof result.score_id === 'string' &&
    Number.isSafeInteger(result.rank) &&
    Number.isSafeInteger(result.total_players) &&
    Number(result.rank) >= 1 &&
    Number(result.total_players) >= Number(result.rank)
  )
}

function isRankingResponse(
  value: unknown,
  expectedGame: GameId,
  expectedDifficulty: Difficulty,
): value is RankingResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Partial<RankingResponse>
  return response.game === expectedGame &&
    response.difficulty === expectedDifficulty &&
    Array.isArray(response.top5) &&
    response.top5.length <= 5 &&
    response.top5.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const row = entry as Partial<RankingEntry>
    return (
      Number.isSafeInteger(row.rank) &&
      Number(row.rank) >= 1 &&
      typeof row.nickname === 'string' &&
      typeof row.score === 'number' &&
      Number.isSafeInteger(row.score) &&
      row.score >= 0 &&
      row.score <= MAX_SCORE &&
      typeof row.played_at === 'string' &&
      !Number.isNaN(Date.parse(row.played_at))
    )
  })
}

function isRecentRecordsResponse(
  value: unknown,
  expectedGame: GameId,
  expectedDifficulty: Difficulty,
): value is RecentRecordsResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Partial<RecentRecordsResponse>
  return response.game === expectedGame &&
    response.difficulty === expectedDifficulty &&
    Array.isArray(response.records) &&
    response.records.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const row = entry as Partial<RecentRecordEntry>
    return (
      typeof row.score_id === 'string' &&
      typeof row.nickname === 'string' &&
      typeof row.score === 'number' &&
      Number.isSafeInteger(row.score) &&
      row.score >= 0 &&
      row.score <= MAX_SCORE &&
      typeof row.played_at === 'string' &&
      !Number.isNaN(Date.parse(row.played_at))
    )
  })
}

/** 정렬 기준: score 내림차순, 동점 시 played_at 오름차순(FR-RK-06) */
function compareScores(a: StoredScore, b: StoredScore): number {
  if (b.score !== a.score) return b.score - a.score
  return a.played_at.localeCompare(b.played_at)
}

/** C-1. POST /api/v1/scores */
export async function submitScore(payload: ScorePayload): Promise<ScoreSubmitResult> {
  assertValidScorePayload(payload)
  if (!USE_MOCK) {
    // game_scores 스키마의 player_key(브라우저별 익명 식별자)·submission_key
    // (재요청 중복 등록 방지)는 ScorePayload에 없는 서버 전용 필드라 여기서
    // 붙여 보낸다 — 게임 페이지 쪽 코드는 이 두 필드를 몰라도 된다.
    const body = {
      ...payload,
      player_key: getPlayerKey(),
      submission_key: crypto.randomUUID(),
    }
    const response = await request(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`점수 등록 실패 (${response.status})`)
    const result: unknown = await response.json()
    if (!isSubmitResult(result)) throw new Error('점수 등록 응답 형식이 올바르지 않습니다.')
    return result
  }

  const store = loadStore()
  const record: StoredScore = {
    id: `score_${Date.now().toString(36)}`,
    nickname: payload.nickname,
    game: payload.game,
    difficulty: payload.difficulty,
    score: payload.score,
    stage_reached: 'stage_reached' in payload ? payload.stage_reached : undefined,
    played_at: new Date().toISOString(),
  }

  const next = [...store, record]
  writeJson(STORE_KEY, next)

  // 순위는 같은 게임·난이도 리더보드 안에서 계산한다
  const board = next.filter((row) => row.game === payload.game && row.difficulty === payload.difficulty)
  board.sort(compareScores)

  return {
    score_id: record.id,
    rank: board.findIndex((row) => row.id === record.id) + 1,
    total_players: board.length,
  }
}

/** C-2. GET /api/v1/rankings?game=&difficulty= */
export async function fetchRankings(
  game: GameId,
  difficulty: Difficulty,
): Promise<RankingResponse> {
  if (!USE_MOCK) {
    const params = new URLSearchParams({ game, difficulty })
    const response = await request(`${API_BASE}/rankings?${params}`)
    if (!response.ok) throw new Error(`랭킹 조회 실패 (${response.status})`)
    const result: unknown = await response.json()
    if (!isRankingResponse(result, game, difficulty)) {
      throw new Error('랭킹 응답 형식이 올바르지 않습니다.')
    }
    return result
  }

  const board = loadStore().filter((row) => row.game === game && row.difficulty === difficulty)
  board.sort(compareScores)

  const top5: RankingEntry[] = board.slice(0, 5).map((row, index) => ({
    rank: index + 1,
    nickname: row.nickname,
    score: row.score,
    played_at: row.played_at,
    ...(game === 'acid_rain' ? { stage_reached: row.stage_reached ?? 1 } : {}),
  }))

  return { game, difficulty, top5 }
}

/** 랭킹 화면의 "내 최근 기록" — GET /api/v1/scores/recent(player_key 기준).
 * rank는 이 응답에 없으므로 화면에서 안 쓰는 placeholder로 0을 채운다. */
export async function fetchMyRecentRecords(
  nickname: string,
  game: GameId,
  difficulty: Difficulty,
  limit = 3,
): Promise<RankingEntry[]> {
  if (!nickname) return []

  if (!USE_MOCK) {
    const params = new URLSearchParams({
      player_key: getPlayerKey(),
      game,
      difficulty,
      limit: String(limit),
    })
    const response = await request(`${API_BASE}/scores/recent?${params}`)
    if (!response.ok) throw new Error(`최근 기록 조회 실패 (${response.status})`)
    const result: unknown = await response.json()
    if (!isRecentRecordsResponse(result, game, difficulty)) {
      throw new Error('최근 기록 응답 형식이 올바르지 않습니다.')
    }
    return result.records.map((record) => ({ ...record, rank: 0 }))
  }

  return loadStore()
    .filter(
      (row) =>
        row.nickname === nickname && row.game === game && row.difficulty === difficulty,
    )
    .sort((a, b) => b.played_at.localeCompare(a.played_at))
    .slice(0, limit)
    .map((row) => ({
      rank: 0,
      nickname: row.nickname,
      score: row.score,
      played_at: row.played_at,
      stage_reached: row.stage_reached,
    }))
}
