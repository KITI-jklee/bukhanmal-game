/* 방문자(page_view)·이용(game_start) 지표용 이벤트 기록. */

import type { Difficulty, GameId } from './types'
import { withPlayerSession } from './playerSession'
import { API_BASE, USE_MOCK, request } from './http'

async function postEvent(body: Record<string, unknown>): Promise<void> {
  if (USE_MOCK) return

  try {
    await withPlayerSession((session) =>
      request(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': session.player_token,
        },
        body: JSON.stringify(body),
        keepalive: true,
      }),
    )
  } catch {
    /* 세션 발급과 이벤트 전송 실패 모두 게임 진행에 영향을 주지 않는다 */
  }
}

export function trackGameStart(game: GameId, difficulty: Difficulty): void {
  void postEvent({ event_type: 'game_start', game, difficulty })
}

export function trackPageView(): void {
  void postEvent({ event_type: 'page_view' })
}
