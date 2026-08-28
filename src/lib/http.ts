/* API 클라이언트 공용 설정 — API_BASE·USE_MOCK 판단과 타임아웃 있는 fetch 래퍼. */

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
export const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' || (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL)

const REQUEST_TIMEOUT_MS = 10_000

/* 10초 타임아웃이 걸린 fetch. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  // window.setTimeout이 아니라 전역 setTimeout을 쓴다 — 이 모듈은 브라우저 실행 환경뿐 아니라 window가 없는 vitest(Node 환경) 단위 테스트에서도 fetch를 목업해 호출된다(tests/admin-api.test.ts 참고).
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
