import type { ReactNode } from 'react'

interface GameOverlayMessageProps {
  /** 'alert' = role="alertdialog" + 메인으로 버튼(로드 실패·데이터 없음),
   *  'loading' = role="status" aria-live="polite", 버튼 없음(데이터 로딩 중) */
  variant: 'alert' | 'loading'
  title: string
  description: ReactNode
  onGoHome?: () => void
  goHomeLabel?: string
}

/** 데이터 로드 실패·로딩 중·엔진 데이터 없음 등 "안내 메시지 한 장"짜리
 *  오버레이. Chosung.tsx·AcidRain.tsx 양쪽에 거의 같은 마크업이 세 번씩
 *  중복돼 있던 걸 하나로 모았다. */
export function GameOverlayMessage({
  variant,
  title,
  description,
  onGoHome,
  goHomeLabel = '메인으로',
}: GameOverlayMessageProps) {
  return (
    <div className="overlay">
      <div
        className="overlay-card"
        role={variant === 'alert' ? 'alertdialog' : 'status'}
        aria-modal={variant === 'alert' ? 'true' : undefined}
        aria-live={variant === 'loading' ? 'polite' : undefined}
      >
        <h3>{title}</h3>
        <p>{description}</p>
        {variant === 'alert' && onGoHome ? (
          <button className="button button--primary" onClick={onGoHome}>
            {goHomeLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

interface GamePauseOverlayProps {
  score: number
  /** 점수 옆에 붙는 진행 상태 조각 — 초성: "문제 3/10", 산성비: "스테이지 2" */
  statusLine: ReactNode
  onResume: () => void
  onRestart: () => void
  onGoHome: () => void
  goHomeLabel?: string
}

/** 일시정지 오버레이("이어하기 / 다시 시작하기 / 메인으로"). Chosung.tsx·
 *  AcidRain.tsx 양쪽에 같은 마크업이 중복돼 있던 걸 하나로 모았다. */
export function GamePauseOverlay({
  score,
  statusLine,
  onResume,
  onRestart,
  onGoHome,
  goHomeLabel = '메인으로',
}: GamePauseOverlayProps) {
  return (
    <div className="overlay">
      <div className="overlay-card" role="dialog" aria-modal="true" aria-label="일시정지">
        <h3>잠시 멈췄어요</h3>
        <p>
          점수 {score.toLocaleString()}점 · {statusLine}
          <br />
          준비되면 이어서 진행하세요.
        </p>
        <div className="overlay-actions">
          <button className="button button--primary" onClick={onResume}>
            이어하기
          </button>
          <button className="button button--outline" onClick={onRestart}>
            다시 시작하기
          </button>
          <button className="button button--ghost" onClick={onGoHome}>
            {goHomeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
