/** 게임 단어 데이터(public/data/*.json) 런타임 로더
 *
 * 예전에는 JS 번들에 그대로 import해 넣었지만, 데이터가 2만 건대로
 * 늘어나며 번들이 수십 MB로 부풀었다. public/에 정적 파일로 두고
 * fetch로 필요할 때만 받아오면 초기 진입(다른 페이지·메인 화면)이
 * 이 데이터를 기다리지 않아도 된다.
 *
 * 모듈 스코프 캐시로 같은 URL은 세션당 한 번만 fetch한다 — "다시
 * 시작하기"로 페이지 컴포넌트가 재마운트돼도 매번 다시 받지 않는다. */

import { useEffect, useState } from 'react'

const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

export interface GameDataState<T> {
  data: T | null
  /** fetch 실패(네트워크 오류·HTTP 에러) 여부. 데이터 자체가 비어있는
   *  경우(선택 난이도에 문제가 없음)는 이 값이 아니라 각 엔진의
   *  status === 'error'로 구분한다. */
  error: boolean
}

export function useGameData<T>(url: string): GameDataState<T> {
  const [state, setState] = useState<GameDataState<T>>(() =>
    cache.has(url) ? { data: cache.get(url) as T, error: false } : { data: null, error: false },
  )

  useEffect(() => {
    if (cache.has(url)) {
      setState({ data: cache.get(url) as T, error: false })
      return
    }

    let cancelled = false
    let request = inflight.get(url) as Promise<T> | undefined
    if (!request) {
      request = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`요청 실패: ${response.status}`)
          return response.json() as Promise<T>
        })
        .finally(() => inflight.delete(url))
      inflight.set(url, request)
    }

    request
      .then((json) => {
        cache.set(url, json)
        if (!cancelled) setState({ data: json, error: false })
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, error: true })
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return state
}
