import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchStats } from '../src/lib/adminApi'

const validStats = {
  total_page_views: 10,
  total_game_starts: 4,
  unique_visitors: 8,
  game_starts_by_game: { chosung: 3, acid_rain: 1 },
  unique_players: 3,
  usage_rate_percent: 40,
  average_game_starts_per_player: 1.3,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchStats', () => {
  it('accepts a valid stats response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validStats), { status: 200 }),
    ))
    await expect(fetchStats('password')).resolves.toEqual(validStats)
  })

  it('rejects a malformed stats response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...validStats, total_page_views: '10' }), { status: 200 }),
    ))
    await expect(fetchStats('password')).rejects.toThrow('통계 응답 형식')
  })
})