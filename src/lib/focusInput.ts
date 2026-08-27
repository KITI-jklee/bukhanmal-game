/** 게임 입력창 포커스 복원 — Chosung.tsx·AcidRain.tsx 양쪽에서 반복되던
 *  `window.setTimeout(() => inputRef.current?.focus(), 0)` iOS 대응 훅을 모았다. */

import type { RefObject } from 'react'

/** 다음 틱으로 미뤄 포커스를 되살린다. requestAnimationFrame이 아니라
 *  setTimeout을 쓴다 — 탭이 백그라운드로 밀리는 등 화면이 실제로 그려지지
 *  않는 순간에는 rAF 콜백 자체가 브라우저 정책상 멈춰서 포커스 복원이
 *  씹힐 수 있다. setTimeout은 그런 상태와 무관하게 항상 실행된다.
 *
 *  반환하는 타이머 id로 필요하면(예: useEffect cleanup) 직접 취소할 수 있다. */
export function focusInputSoon(
  ref: RefObject<HTMLInputElement | null>,
  options?: FocusOptions,
): number {
  return window.setTimeout(() => ref.current?.focus(options), 0)
}

/** 이미 그 입력창에 포커스가 있으면 다시 focus()하지 않는다. 엔터 제출처럼
 *  포커스가 빠지지 않은 상태에서 다시 focus()를 부르면 iOS가 화면을
 *  위아래로 재스크롤한다 — 버튼 클릭 등 실제로 포커스가 빠졌을 때만
 *  스크롤 없이 복원한다. */
export function refocusInputIfBlurred(ref: RefObject<HTMLInputElement | null>): void {
  window.setTimeout(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.focus({ preventScroll: true })
  }, 0)
}
