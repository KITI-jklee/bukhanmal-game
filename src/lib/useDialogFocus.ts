import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function useDialogFocus(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = ref.current
    const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    // 닫기(X) 버튼처럼 DOM상 헤더에 먼저 나오지만 실수로 누르면 다이얼로그가
    // 그대로 닫혀버리는 요소는 초기 포커스에서 제외한다(코드리뷰로 발견 -
    // DifficultyDialog·GameGuideDialog는 닫기 버튼이 항상 첫 focusable이라
    // 열자마자 엔터/스페이스를 누르면 바로 닫혔다). data-dialog-close로
    // 표시된 버튼만 건너뛰고, 탭 트랩 대상에는 그대로 포함한다.
    const initial = focusable.find((item) => !item.hasAttribute('data-dialog-close')) ?? focusable[0]
    initial?.focus()

    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      previous?.focus()
    }
  }, [ref])
}
