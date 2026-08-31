import { beforeEach, describe, expect, it, vi } from 'vitest'

const { request, withPlayerSession } = vi.hoisted(() => ({
  request: vi.fn(),
  withPlayerSession: vi.fn(async (callback: (session: { player_token: string }) => Promise<Response>) => callback({ player_token: 'token' })),
}))

vi.mock('../src/lib/http', () => ({ API_BASE: '/api/v1', USE_MOCK: false, request }))
vi.mock('../src/lib/playerSession', () => ({ withPlayerSession }))

import { fetchMyRecentRecords, fetchRankings, submitScore } from '../src/lib/rankingApi'

const chosungPayload = {
  nickname: '테스터', game: 'chosung' as const, difficulty: '보통' as const,
  score: 10, correct_count: 1, no_hint_correct_count: 1, max_combo: 1,
}

beforeEach(() => {
  request.mockReset()
  withPlayerSession.mockClear()
  vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' })
})

describe('랭킹 API 클라이언트', () => {
  it('서명된 세션과 중복 방지 키로 점수를 등록한다', async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ score_id: 'score-1', rank: 1, total_players: 2 }), { status: 201 }))
    await expect(submitScore(chosungPayload)).resolves.toEqual({ score_id: 'score-1', rank: 1, total_players: 2 })

    expect(request).toHaveBeenCalledWith('/api/v1/scores', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Player-Token': 'token' },
    }))
    const body = JSON.parse(request.mock.calls[0][1].body)
    expect(body).toEqual({ ...chosungPayload, submission_key: '11111111-1111-4111-8111-111111111111' })
  })

  it('잘못된 점수 입력과 잘못된 등록 응답을 거부한다', async () => {
    await expect(submitScore({ ...chosungPayload, score: -1 })).rejects.toThrow()
    request.mockResolvedValue(new Response(JSON.stringify({ score_id: 'x', rank: 3, total_players: 2 }), { status: 201 }))
    await expect(submitScore(chosungPayload)).rejects.toThrow('응답 형식')
  })

  it('게임과 난이도가 일치하는 TOP 5 응답만 허용한다', async () => {
    const valid = {
      game: 'chosung', difficulty: '보통',
      top5: [{ rank: 1, nickname: '가', score: 10, played_at: '2026-01-01T00:00:00Z' }],
    }
    request.mockResolvedValue(new Response(JSON.stringify(valid), { status: 200 }))
    await expect(fetchRankings('chosung', '보통')).resolves.toEqual(valid)
    expect(request).toHaveBeenCalledWith('/api/v1/rankings?game=chosung&difficulty=%EB%B3%B4%ED%86%B5')

    request.mockResolvedValue(new Response(JSON.stringify({ ...valid, game: 'acid_rain' }), { status: 200 }))
    await expect(fetchRankings('chosung', '보통')).rejects.toThrow('응답 형식')
  })

  it('최근 기록은 빈 닉네임이면 요청하지 않고 서버 기록의 rank를 0으로 변환한다', async () => {
    await expect(fetchMyRecentRecords('', 'chosung', '보통')).resolves.toEqual([])
    expect(request).not.toHaveBeenCalled()

    request.mockResolvedValue(new Response(JSON.stringify({
      game: 'chosung', difficulty: '보통',
      records: [{ score_id: 's1', nickname: '가', score: 3, played_at: '2026-01-01T00:00:00Z' }],
    }), { status: 200 }))
    await expect(fetchMyRecentRecords('가', 'chosung', '보통', 1)).resolves.toEqual([
      { score_id: 's1', nickname: '가', score: 3, played_at: '2026-01-01T00:00:00Z', rank: 0 },
    ])
    expect(withPlayerSession).toHaveBeenCalledOnce()
  })

  it('HTTP 오류 상태를 명시적인 오류로 변환한다', async () => {
    request.mockResolvedValue(new Response(null, { status: 503 }))
    await expect(fetchRankings('chosung', '보통')).rejects.toThrow('503')
  })
})
