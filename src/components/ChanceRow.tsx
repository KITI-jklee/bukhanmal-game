import type { ReactNode } from 'react'
import { BulbIcon, HeartIcon } from './Icons'

interface ChanceRowProps {
  variant: 'desktop' | 'mobile'
  hearts: number
  maxHearts: number
  hintLevel: number
  maxHintLevel: number
  hintsLeft: number
  onHintTap: () => void
  /** 모바일 전용 힌트 팝오버(hintPopupOpen) — 데스크톱에는 없다 */
  popover?: ReactNode
}

/** 초성게임 상단의 "기회(하트)+힌트" 띠. 데스크톱 HUD와 모바일 문제 카드
 *  안에 같은 마크업이 중복돼 있던 걸 하나로 모았다(Chosung.tsx). */
export function ChanceRow({
  variant,
  hearts,
  maxHearts,
  hintLevel,
  maxHintLevel,
  hintsLeft,
  onHintTap,
  popover,
}: ChanceRowProps) {
  return (
    <div className={`chance-row chance-row--${variant}`}>
      <div className="chance-group" aria-label={`남은 기회 ${hearts}개`}>
        <span>기회</span>
        {Array.from({ length: maxHearts }, (_, i) => (
          <HeartIcon key={i} size={15} filled={i < hearts} />
        ))}
      </div>
      <div className="chance-group chance-group--hint">
        <button
          type="button"
          className="hint-trigger"
          aria-label={`남은 힌트 ${hintsLeft}개`}
          onClick={onHintTap}
        >
          <span className="hint-trigger-label hint-trigger-label--desktop">힌트</span>
          <span className="hint-trigger-label hint-trigger-label--mobile">힌트보기</span>
          {Array.from({ length: maxHintLevel }, (_, i) => (
            <BulbIcon key={i} size={15} filled={i >= hintLevel} />
          ))}
        </button>

        {popover}
      </div>
    </div>
  )
}
