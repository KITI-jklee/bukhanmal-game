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

interface GameOverOverlayProps {
  score: number
}

/** 방어 게이지 소진 직후 뜨는 화면. 타이핑 도중 화면이 곧바로 닉네임
 *  등록창으로 바뀌면 당황스럽다는 피드백에 따라, 시작 전 카운트다운
 *  (Countdown.tsx)과 같은 스타일 — 살짝 어두운 화면에 큰 글씨 한 줄 —
 *  로 "게임이 끝났다"는 걸 먼저 보여준다. 흰 카드 모달은 화면 대비가
 *  약해 잘 안 예뻐서 뺐다. 일정 시간 뒤 자동으로 결과 화면으로
 *  넘어간다(AcidRain.tsx의 타이머). */
export function GameOverOverlay({ score }: GameOverOverlayProps) {
  return (
    <div className="game-over-screen" role="status" aria-live="assertive">
      <div className="game-over-inner">
        <strong>게임 오버</strong>
        <span>{score.toLocaleString()}점</span>
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
