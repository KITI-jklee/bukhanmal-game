/** 방문자(page_view)·이용(game_start) 지표용 이벤트 기록.
 *
 * rankingApi.ts와 달리 순위·점수와 무관한 순수 카운팅이라 실패해도 게임/앱
 * 진행을 막으면 안 된다 — 그래서 결과를 기다리지 않고(fire-and-forget)
 * 에러도 조용히 무시한다. 목업 모드(USE_MOCK)에도 대응하는 백엔드가 없으니
 * 그때는 그냥 아무 일도 하지 않는다. */

import type { Difficulty, GameId } from './types'
import { getPlayerKey } from './storage'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL)

function postEvent(body: Record<string, unknown>): void {
  if (USE_MOCK) return

  fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // 창을 바로 닫아도(다음 페이지로 이동해도) 요청이 끝까지 가도록 keepalive.
    keepalive: true,
  }).catch(() => {
    /* 카운팅 실패가 게임 진행에 영향을 주면 안 된다 */
  })
}

/** 난이도 선택 후 실제 게임 화면으로 넘어가는 시점에 호출한다. 중도 이탈
 * 여부와 무관하게 매 시작마다 기록되므로(동영상 조회수 방식), 이후
 * game_scores의 완료 건수와 비교하면 이탈률도 계산할 수 있다. */
export function trackGameStart(game: GameId, difficulty: Difficulty): void {
  postEvent({ event_type: 'game_start', player_key: getPlayerKey(), game, difficulty })
}

/** 앱이 브라우저에서 처음 뜰 때(App.tsx 최상단) 한 번만 호출한다 — 페이지 내
 * 이동(SPA 라우팅)마다가 아니라 "방문 1회"를 세는 게 목적이라 여기서만 쏜다. */
export function trackPageView(): void {
  postEvent({ event_type: 'page_view', player_key: getPlayerKey() })
}
