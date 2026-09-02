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

/** 실패 응답의 JSON `detail`을 최대한 읽어 사용자에게 보여줄 메시지를 만든다.
 * 백엔드(FastAPI)는 400/422/429 등에서 "사용할 수 없는 닉네임입니다." 같은
 * 구체적인 이유를 `{"detail": "..."}` 형태로 보내주는데, 예전엔 각 API
 * 클라이언트가 이걸 안 읽고 상태코드만 넣은 문구("점수 등록 실패 (429)")로
 * 대신해 사용자가 실제 원인을 알 수 없었다(코드리뷰로 발견). detail이
 * 없거나 JSON 파싱이 안 되면 fallback 문구를 대신 쓴다. */
export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && typeof (body as { detail?: unknown }).detail === 'string') {
      return (body as { detail: string }).detail
    }
  } catch {
    // 본문이 JSON이 아니거나 비어 있으면 fallback을 쓴다.
  }
  return fallback
}
