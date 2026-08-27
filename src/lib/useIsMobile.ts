/** 모바일(뷰포트 폭 ≤768px) 여부 — Chosung.tsx·AcidRain.tsx가 각자
 *  `window.matchMedia('(max-width: 768px)')`를 따로 검사하던 걸 한 곳으로 모았다.
 *  모바일 전용 CSS(@media (max-width: 768px))와 반드시 같은 기준선을 써야 한다. */

import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 768px)'

/** 지금 이 순간의 모바일 여부를 동기적으로 읽는다. 리액트 렌더링과 무관하게
 *  한 번만 확인하면 되는 곳(예: 엔진 생성 시점에 고정할 값)에서 쓴다 — 이
 *  값을 이후 뷰포트가 바뀌어도 다시 읽지 않는 게 기존 동작이었다. */
export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches
}

/** 리액트 컴포넌트 안에서 쓰는 반응형 버전 — 창 크기 조절·화면 회전으로
 *  경계를 넘나들면 다시 렌더링된다. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(isMobileViewport)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(MOBILE_QUERY)
    const apply = () => setIsMobile(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  return isMobile
}
