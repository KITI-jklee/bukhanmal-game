import { beforeEach, describe, expect, it, vi } from 'vitest'

const request = vi.fn()
vi.mock('../src/lib/http', () => ({ API_BASE: '/api/v1', request }))

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  clear() { this.values.clear() }
}

beforeEach(() => {
  request.mockReset()
  vi.stubGlobal('window', { localStorage: new MemoryStorage() })
  vi.resetModules()
})

describe('플레이어 세션', () => {
  it('동시 호출은 하나의 발급 요청을 공유하고 저장된 세션을 재사용한다', async () => {
    let resolveResponse!: (response: Response) => void
    request.mockReturnValue(new Promise<Response>((resolve) => { resolveResponse = resolve }))
    const { getPlayerSession } = await import('../src/lib/playerSession')
    const first = getPlayerSession()
    const second = getPlayerSession()
    expect(request).toHaveBeenCalledOnce()
    resolveResponse(new Response(JSON.stringify({ player_key: 'player', player_token: 'token' }), { status: 200 }))
    await expect(Promise.all([first, second])).resolves.toEqual([
      { player_key: 'player', player_token: 'token' },
      { player_key: 'player', player_token: 'token' },
    ])
    await getPlayerSession()
    expect(request).toHaveBeenCalledOnce()
  })

  it('401 응답이면 세션을 한 번 재발급하고 요청을 재시도한다', async () => {
    request
      .mockResolvedValueOnce(new Response(JSON.stringify({ player_key: 'old', player_token: 'old-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ player_key: 'new', player_token: 'new-token' }), { status: 200 }))
    const { withPlayerSession } = await import('../src/lib/playerSession')
    const operation = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(withPlayerSession(operation)).resolves.toMatchObject({ status: 200 })
    expect(operation).toHaveBeenNthCalledWith(1, { player_key: 'old', player_token: 'old-token' })
    expect(operation).toHaveBeenNthCalledWith(2, { player_key: 'new', player_token: 'new-token' })
  })

  it('불완전한 발급 응답을 거부하고 다음 호출에서 다시 시도한다', async () => {
    request
      .mockResolvedValueOnce(new Response(JSON.stringify({ player_key: 'player' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ player_key: 'player', player_token: 'token' }), { status: 200 }))
    const { getPlayerSession } = await import('../src/lib/playerSession')
    await expect(getPlayerSession()).rejects.toThrow('응답')
    await expect(getPlayerSession()).resolves.toEqual({ player_key: 'player', player_token: 'token' })
  })
})
