/* 시작 전 카운트다운 — FR-CM-03 기획서대로 3·2·1(1초 간격). */

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
