/* 모바일 가상 키보드 대응 — NFR-02 visualViewport 변화를 CSS 변수로 흘려보내 입력창이 키보드에 가려지지 않게 한다. */

import { useEffect } from 'react'

export function useViewportMetrics(): void {
  useEffect(() => {
    const visual = window.visualViewport
    const root = document.documentElement
    let maxViewportHeight = visual?.height ?? window.innerHeight

    const apply = () => {
      const height = visual?.height ?? window.innerHeight
      maxViewportHeight = Math.max(maxViewportHeight, height)
      root.style.setProperty('--viewport-height', `${height}px`)
      root.style.setProperty('--viewport-offset-top', `${Math.round(visual?.offsetTop ?? 0)}px`)

      // 레이아웃 뷰포트와의 차이가 곧 키보드가 차지한 높이.
      const inset = visual ? Math.max(0, window.innerHeight - visual.height - visual.offsetTop) : 0
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
      // interactive-widget=resizes-content를 적용하는 브라우저에서는 innerHeight와 visualViewport.height가 함께 줄어 inset이 0이 될 수 있다.
      const viewportReduction = maxViewportHeight - height
      root.toggleAttribute('data-keyboard-open', inset > 120 || viewportReduction > 120)
    }

    const handleOrientationChange = () => {
      maxViewportHeight = visual?.height ?? window.innerHeight
      apply()
    }

    apply()
    visual?.addEventListener('resize', apply)
    visual?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', handleOrientationChange)

    // 리사이즈 이벤트가 오지 않는 경로(일부 모바일 브라우저의 주소창 변화 등)에서도 값이 낡지 않도록 실제 레이아웃 크기 변화를 직접 관찰한다.
    const observer = new ResizeObserver(apply)
    observer.observe(root)

    return () => {
      observer.disconnect()
      root.removeAttribute('data-keyboard-open')
      visual?.removeEventListener('resize', apply)
      visual?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])
}

/* 모바일(뷰포트 폭 ≤ breakpoint)에서만 게임 화면이 떠 있는 동안 html·body의 스크롤·터치 제스처를 잠근다. */
export function useLockBodyScroll(breakpoint = 768): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const html = document.documentElement
    const { body } = document
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlTouchAction: html.style.touchAction,
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
    }

    const restore = () => {
      html.style.overflow = prev.htmlOverflow
      html.style.touchAction = prev.htmlTouchAction
      body.style.overflow = prev.bodyOverflow
      body.style.touchAction = prev.bodyTouchAction
    }

    const apply = () => {
      if (mql.matches) {
        html.style.overflow = 'hidden'
        html.style.touchAction = 'none'
        body.style.overflow = 'hidden'
        body.style.touchAction = 'none'
      } else {
        restore()
      }
    }

    apply()
    mql.addEventListener('change', apply)

    return () => {
      mql.removeEventListener('change', apply)
      restore()
    }
  }, [breakpoint])
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
