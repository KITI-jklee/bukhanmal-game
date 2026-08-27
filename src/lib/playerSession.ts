/** 서버가 발급한 익명 플레이어 세션. */
import { API_BASE, request } from './http'

const SESSION_KEY = 'tongil.player_session.v1'

export interface PlayerSession {
  player_key: string
  player_token: string
}

let pending: Promise<PlayerSession> | null = null

function readSession(): PlayerSession | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null')
    if (typeof value !== 'object' || value === null) return null
    const row = value as Partial<PlayerSession>
    return typeof row.player_key === 'string' && typeof row.player_token === 'string'
      ? { player_key: row.player_key, player_token: row.player_token }
      : null
  } catch {
    return null
  }
}

export function clearPlayerSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    /* 저장소가 막혀 있어도 새 세션 발급은 계속 시도한다 */
  }
}

export async function getPlayerSession(): Promise<PlayerSession> {
  const stored = readSession()
  if (stored) return stored
  if (!pending) {
    pending = request(`${API_BASE}/players/session`, { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`플레이어 세션 발급 실패 (${response.status})`)
        const value = (await response.json()) as PlayerSession
        if (!value.player_key || !value.player_token) {
          throw new Error('플레이어 세션 응답이 올바르지 않습니다.')
        }
        try {
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(value))
        } catch {
          /* 저장이 막혀도 현재 요청은 계속 진행한다 */
        }
        return value
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

/** 만료·키 회전으로 401이 오면 저장 세션을 한 번만 폐기하고 재발급한다. */
export async function withPlayerSession(
  request: (session: PlayerSession) => Promise<Response>,
): Promise<Response> {
  let session = await getPlayerSession()
  let response = await request(session)
  if (response.status === 401) {
    clearPlayerSession()
    session = await getPlayerSession()
    response = await request(session)
  }
  return response
}