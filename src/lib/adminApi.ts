/* 관리자 통계 화면 API 클라이언트 — GET /api/v1/admin/stats(비밀번호 헤더 필요) 발주처가 Vercel 대시보드에 접근할 수 없어, 방문자 수·게임 이용 횟수를 이 앱 안에서 직접 보여주기 위한 전용 엔드포인트다. */

import type { StatsResponse } from './types'
import { API_BASE, readErrorMessage, request } from './http'

/* 비밀번호가 틀리면 서버가 401을 준다 — 그 경우를 구분해 화면에서 다른 안내를 보여줄 수 있게 전용 에러 클래스로 던진다. */
export class AdminAuthError extends Error {}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
}

function isStatsResponse(value: unknown): value is StatsResponse {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Partial<StatsResponse>
  const byGame = row.game_starts_by_game
  return (
    isNonNegativeInteger(row.total_page_views) &&
    isNonNegativeInteger(row.total_game_starts) &&
    isNonNegativeInteger(row.unique_visitors) &&
    isNonNegativeInteger(row.unique_players) &&
    typeof byGame === 'object' &&
    byGame !== null &&
    isNonNegativeInteger(byGame.chosung) &&
    isNonNegativeInteger(byGame.acid_rain) &&
    isNullableFiniteNumber(row.usage_rate_percent) &&
    isNullableFiniteNumber(row.average_game_starts_per_player)
  )
}

export async function fetchStats(password: string): Promise<StatsResponse> {
  const response = await request(`${API_BASE}/admin/stats`, {
    headers: { 'X-Admin-Password': password },
  })
  if (response.status === 401) {
    throw new AdminAuthError('비밀번호가 올바르지 않습니다.')
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `통계 조회 실패 (${response.status})`))
  }
  const result: unknown = await response.json()
  if (!isStatsResponse(result)) {
    throw new Error("통계 응답 형식이 올바르지 않습니다.")
  }
  return result
}
