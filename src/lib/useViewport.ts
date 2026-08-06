/** 모바일 가상 키보드 대응 — NFR-02
 *
 * visualViewport 변화를 CSS 변수로 흘려보내 입력창이 키보드에 가려지지 않게 한다.
 * 낙하 좌표는 진행률 기준이라 높이가 바뀌어도 단어가 순간 이동하지 않는다. */

import { useEffect } from 'react'

export function useViewportMetrics(): void {
  useEffect(() => {
    const visual = window.visualViewport
    const root = document.documentElement

    const apply = () => {
      const height = visual?.height ?? window.innerHeight
      root.style.setProperty('--viewport-height', `${height}px`)

      // 레이아웃 뷰포트와의 차이가 곧 키보드가 차지한 높이
      const inset = visual ? Math.max(0, window.innerHeight - visual.height - visual.offsetTop) : 0
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    }

    apply()
    visual?.addEventListener('resize', apply)
    visual?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)

    // 리사이즈 이벤트가 오지 않는 경로(일부 모바일 브라우저의 주소창 변화 등)에서도
    // 값이 낡지 않도록 실제 레이아웃 크기 변화를 직접 관찰한다.
    const observer = new ResizeObserver(apply)
    observer.observe(root)

    return () => {
      observer.disconnect()
      visual?.removeEventListener('resize', apply)
      visual?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [])
}

/** 탭 이탈·앱 전환·화면 회전 시 자동 일시정지 — FR-CM-05 */
export function useAutoPause(onPause: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    const handleVisibility = () => {
      if (document.hidden) onPause()
    }

    window.addEventListener('blur', onPause)
    window.addEventListener('orientationchange', onPause)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('blur', onPause)
      window.removeEventListener('orientationchange', onPause)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [onPause, enabled])
}
