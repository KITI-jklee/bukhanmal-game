/** 시작 전 카운트다운 — FR-CM-03
 *
 * 기획서대로 3·2·1(1초 간격). 자세한 규칙은 게임 카드의 "게임 방법 보기"
 * 모달에서 볼 수 있으므로 시작을 오래 붙잡지 않는다. */

import { useEffect, useState } from 'react'

interface Props {
  onDone: () => void
  seconds?: number
  hint?: React.ReactNode
}

export function Countdown({ onDone, seconds = 3, hint }: Props) {
  const [count, setCount] = useState(seconds)

  useEffect(() => {
    if (count === 0) {
      onDone()
      return
    }
    const timer = window.setTimeout(() => setCount((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [count, onDone])

  if (count === 0) return null

  return (
    <div className="countdown" role="status" aria-live="assertive">
      <div className="countdown-inner">
        <strong key={count}>{count}</strong>
        {hint}
      </div>
    </div>
  )
}
