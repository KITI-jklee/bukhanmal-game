/** 모바일 가상 키보드 대응 — NFR-02
 *
 * visualViewport 변화를 CSS 변수로 흘려보내 입력창이 키보드에 가려지지 않게 한다.
 * 낙하 좌표는 진행률 기준이라 높이가 바뀌어도 단어가 순간 이동하지 않는다.
 *
 * iOS Safari는 키보드가 뜨면 레이아웃 뷰포트(position: fixed의 기준)와
 * 실제 보이는 화면(visualViewport)이 어긋나는 알려진 버그가 있다 — fixed
 * 요소가 화면 밖으로 밀려 보이는 게 이 버그 때문이다. visualViewport의
 * offsetTop을 --viewport-offset-top으로 흘려보내고, 화면 컨테이너(모바일
 * 전용 CSS)가 transform: translateY로 그만큼 스스로 보정하게 한다(브라우저의
 * 스크롤 위치를 직접 고치는 것보다 이 방식이 안정적이라고 알려져 있다). */

import { useEffect } from 'react'

export function useViewportMetrics(): void {
  useEffect(() => {
    const visual = window.visualViewport
    const root = document.documentElement

    const apply = () => {
      const height = visual?.height ?? window.innerHeight
      root.style.setProperty('--viewport-height', `${height}px`)
      root.style.setProperty('--viewport-offset-top', `${Math.round(visual?.offsetTop ?? 0)}px`)

      // 레이아웃 뷰포트와의 차이가 곧 키보드가 차지한 높이. .app-footer·
      // .toast처럼 일반 문서 흐름(스크롤 가능, 화면 높이 고정 안 됨) 위에서
      // 키보드를 피해야 하는 요소들이 쓴다.
      //
      // 주의: 초성·산성비 게임 화면(.screen--quiz/.screen--rain)처럼 이미
      // --viewport-height(키보드 위 가시 영역)로 높이 자체가 줄어든
      // 컨테이너 안에서는 이 값을 또 더하면 안 된다 — 키보드 높이가 두 번
      // 반영돼 남은 영역이 거의 0으로 눌린다(실제로 그래서 한 번 이 버그가
      // 났었다 — Chosung.css/AcidRain.css의 .answer-dock/.rain-dock 참고).
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

/** 모바일(뷰포트 폭 ≤ breakpoint)에서만 게임 화면이 떠 있는 동안 html·body의
 * 스크롤·터치 제스처를 잠근다. 가상 키보드가 뜰 때 브라우저가 "입력창을
 * 보이게" 문서를 스크롤시키는 걸 막기 위함이다.
 *
 * 데스크톱(> breakpoint)에서는 전혀 손대지 않는다 — matchMedia로 조건을
 * 걸고, 창 크기 조절·화면 회전으로 경계를 넘나들 때도 실시간으로
 * 잠금/해제한다(모바일 전용 CSS와 같은 기준선을 써야 하므로 breakpoint
 * 인자를 CSS의 @media (max-width: 768px)와 반드시 맞춰야 한다). */
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
