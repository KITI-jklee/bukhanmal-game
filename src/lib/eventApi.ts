/* 방문자(page_view)·이용(game_start) 지표용 이벤트 기록. */

import type { Difficulty, GameId } from './types'
import { withPlayerSession } from './playerSession'
import { API_BASE, USE_MOCK, request } from './http'

const EVENT_MAX_ATTEMPTS = 3

async function postEvent(body: Record<string, unknown>): Promise<void> {
  if (USE_MOCK) return

  for (let attempt = 1; attempt <= EVENT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await withPlayerSession((session) =>
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
      // 4xx(예: 429 rate limit)는 짧은 재시도로 해결되지 않으니 바로 포기하고,
      // 네트워크 오류·5xx만 일시적 문제로 보고 재시도한다.
      if (response.ok || response.status < 500) return
    } catch {
      /* 타임아웃/네트워크 오류 - 아래에서 재시도 */
    }
    if (attempt < EVENT_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 700))
    }
  }
  /* 재시도까지 다 실패해도 게임 진행에는 영향을 주지 않는다 */
}

export function trackGameStart(game: GameId, difficulty: Difficulty): void {
  void postEvent({ event_type: 'game_start', game, difficulty })
}

export function trackPageView(): void {
  void postEvent({ event_type: 'page_view' })
}
