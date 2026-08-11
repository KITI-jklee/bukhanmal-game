/** 관리자 통계 화면 API 클라이언트 — GET /api/v1/admin/stats(비밀번호 헤더 필요)
 *
 * 발주처가 Vercel 대시보드에 접근할 수 없어, 방문자 수·게임 이용 횟수를
 * 이 앱 안에서 직접 보여주기 위한 전용 엔드포인트다. */

import type { StatsResponse } from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** 비밀번호가 틀리면 서버가 401을 준다 — 그 경우를 구분해 화면에서 다른
 * 안내를 보여줄 수 있게 전용 에러 클래스로 던진다. */
export class AdminAuthError extends Error {}

export async function fetchStats(password: string): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE}/admin/stats`, {
    headers: { 'X-Admin-Password': password },
  })
  if (response.status === 401) {
    throw new AdminAuthError('비밀번호가 올바르지 않습니다.')
  }
  if (!response.ok) {
    throw new Error(`통계 조회 실패 (${response.status})`)
  }
  return (await response.json()) as StatsResponse
}
