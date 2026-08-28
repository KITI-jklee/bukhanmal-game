import { DEFENSE_MAX } from '../game/acidRainConfig'
import { ShieldIcon } from './Icons'

interface DefenseGaugeProps {
  defense: number
  /** defenseTone()이 돌려주는 색상 단계 */
  tone: string
  /** 모바일 상단 오버레이용 변형 — 지정하면 defense-meter--board 클래스가 붙는다 */
  variant?: 'board'
}

/* 방어 게이지 표시. */
export function DefenseGauge({ defense, tone, variant }: DefenseGaugeProps) {
  return (
    <div className={variant ? `defense-meter defense-meter--${variant}` : 'defense-meter'}>
      <div className="defense-label">
        <span>
          <ShieldIcon size={11} /> 방어 게이지
        </span>
        <strong>{defense}%</strong>
      </div>
      <div className={`defense-track defense-track--${tone}`}>
        <span style={{ width: `${(defense / DEFENSE_MAX) * 100}%` }} />
      </div>
    </div>
  )
}
