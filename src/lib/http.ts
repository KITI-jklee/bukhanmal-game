/** API 클라이언트 공용 설정 — API_BASE·USE_MOCK 판단과 타임아웃 있는 fetch 래퍼.
 *
 * adminApi.ts·eventApi.ts·playerSession.ts·rankingApi.ts가 모두 이 모듈을 통해
 * 서버와 통신한다. VITE_API_BASE_URL이 설정되어 있으면 실제 FastAPI 백엔드를
 * 호출하고, 그렇지 않을 때만(로컬 데모 등) 목업으로 동작한다 — USE_MOCK 판단
 * 로직 참고. */

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
export const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' || (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL)

const REQUEST_TIMEOUT_MS = 10_000

/** 10초 타임아웃이 걸린 fetch. 응답을 그대로 돌려주므로 상태 코드(401 등)에
 *  따라 다르게 처리해야 하는 호출부(adminApi의 AdminAuthError 등)는 응답을
 *  받은 뒤 직접 분기하면 된다. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  // window.setTimeout이 아니라 전역 setTimeout을 쓴다 — 이 모듈은 브라우저
  // 실행 환경뿐 아니라 window가 없는 vitest(Node 환경) 단위 테스트에서도
  // fetch를 목업해 호출된다(tests/admin-api.test.ts 참고).
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('서버 응답 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
