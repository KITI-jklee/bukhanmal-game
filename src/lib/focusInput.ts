/* 게임 입력창 포커스 복원 — Chosung.tsx·AcidRain.tsx 양쪽에서 반복되던 `window.setTimeout(() => inputRef.current?.focus(), 0)` iOS 대응 훅을 모았다. */

import type { RefObject } from 'react'

/* 다음 틱으로 미뤄 포커스를 되살린다. */
export function focusInputSoon(
  ref: RefObject<HTMLInputElement | null>,
  options?: FocusOptions,
): number {
  return window.setTimeout(() => ref.current?.focus(options), 0)
}

/* 이미 그 입력창에 포커스가 있으면 다시 focus()하지 않는다. */
export function refocusInputIfBlurred(ref: RefObject<HTMLInputElement | null>): void {
  window.setTimeout(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.focus({ preventScroll: true })
  }, 0)
}
