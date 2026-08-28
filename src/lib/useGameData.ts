/* 게임 단어 데이터(public/data/*.json) 런타임 로더 예전에는 JS 번들에 그대로 import해 넣었지만, 데이터가 2만 건대로 늘어나며 번들이 수십 MB로 부풀었다. */

import { useEffect, useState } from 'react'

const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

export interface GameDataState<T> {
  data: T | null
  /* fetch 실패(네트워크 오류·HTTP 에러) 여부. */
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
