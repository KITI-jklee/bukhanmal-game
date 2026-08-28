import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from '../lib/router'
import { Countdown } from '../components/Countdown'
import { DefenseGauge } from '../components/DefenseGauge'
import { GameOverOverlay, GameOverlayMessage, GamePauseOverlay } from '../components/GameOverlay'
import { PauseIcon, ZapIcon } from '../components/Icons'
import { AcidRainEngine, type EngineSnapshot } from '../game/AcidRainEngine'
import {
  GAME_OVER_AUTO_ADVANCE_SECONDS,
  MOBILE_FALL_DURATION_SCALE,
  TIME_STOP_DURATION,
  defenseTone,
} from '../game/acidRainConfig'
import type { AcidRainPair, Difficulty } from '../lib/types'
import { normalizeDifficulty } from '../lib/types'
import { focusInputSoon, refocusInputIfBlurred } from '../lib/focusInput'
import { useGameData } from '../lib/useGameData'
import { isMobileViewport } from '../lib/useIsMobile'
import { useAutoPause, useLockBodyScroll } from '../lib/useViewport'
import './AcidRain.css'

const DATA_URL = `${import.meta.env.BASE_URL}data/acidrain_pairs.json`

export function AcidRain() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: allPairs, error: loadError } = useGameData<AcidRainPair[]>(DATA_URL)

  const difficulty = useMemo<Difficulty>(() => {
    return normalizeDifficulty(params.get('difficulty')) ?? '보통'
  }, [params])

  // 일시정지 중 "다시 시작하기"를 누르면 값을 올려 엔진을 새로 만든다.
  const [restartKey, setRestartKey] = useState(0)
  // 단어 데이터가 fetch로 아직 도착하지 않았으면 엔진을 만들지 않는다.
  const engine = useMemo(() => {
    void restartKey
    return allPairs
      ? new AcidRainEngine(
          allPairs,
          difficulty,
          isMobileViewport() ? MOBILE_FALL_DURATION_SCALE : 1,
        )
      : null
  }, [allPairs, difficulty, restartKey])

  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(() => engine?.snapshot() ?? null)
  const [counting, setCounting] = useState(true)
  const [input, setInput] = useState('')
  const composingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!engine) return
    return engine.subscribe(setSnapshot)
  }, [engine])
  useEffect(() => {
    if (!engine) return
    return () => engine.destroy()
  }, [engine])

  // 오답·놓침 피드백 — (지원 기기에서) 진동.
  useEffect(() => {
    if (snapshot?.feedback?.kind !== 'wrong' && snapshot?.feedback?.kind !== 'miss') return
    navigator.vibrate?.(120)
  }, [snapshot?.feedback])

  useEffect(() => {
    if (!engine) return
    setSnapshot(engine.snapshot())
    setCounting(true)
    setInput('')
  }, [engine])

  // 시작·이어하기로 입력창이 다시 활성화된 다음 자동으로 포커스를 복원한다.
  useEffect(() => {
    if (counting || snapshot?.status !== 'playing') return
    const timer = focusInputSoon(inputRef)
    return () => window.clearTimeout(timer)
  }, [counting, snapshot?.status])

  // 방어 게이지가 0이 되면 "게임 오버" 모달을 띄운다 (FR-AR-08).
  const finishGame = useCallback(() => {
    if (!engine) return
    navigate('/result', { replace: true, state: engine.buildResult() })
  }, [engine, navigate])

  useEffect(() => {
    if (!engine || snapshot?.status !== 'over') return
    const timer = window.setTimeout(finishGame, GAME_OVER_AUTO_ADVANCE_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [snapshot?.status, engine, finishGame])

  const pause = useCallback(() => engine?.pause(), [engine])
  useAutoPause(pause, snapshot?.status === 'playing')
  useLockBodyScroll()

  const handleStart = useCallback(() => {
    if (!engine) return
    setCounting(false)
    engine.start()
    inputRef.current?.focus()
  }, [engine])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    // 한글 조합 중인 입력은 판정하지 않는다 (FR-CM-06)
    if (composingRef.current || !engine) return
    engine.submit(input)
    setInput('')
    // 엔터 제출 때는 입력창이 이미 활성화돼 있으므로 다시 focus하면 iOS가 화면을 위아래로 재스크롤한다.
    refocusInputIfBlurred(inputRef)
  }

  if (loadError) {
    return (
      <div className="app-shell screen--rain">
        <GameOverlayMessage
          variant="alert"
          title="단어 데이터를 불러오지 못했어요"
          description="네트워크 상태를 확인한 뒤 메인에서 다시 시도해 주세요."
          onGoHome={() => navigate('/')}
        />
      </div>
    )
  }

  if (!engine || !snapshot) {
    return (
      <div className="app-shell screen--rain">
        <GameOverlayMessage
          variant="loading"
          title="단어를 불러오는 중이에요"
          description="잠시만 기다려 주세요."
        />
      </div>
    )
  }

  const tone = defenseTone(snapshot.defense)
  const isPaused = snapshot.status === 'paused'
  const hasDataError = snapshot.status === 'error'
  const isGameOver = snapshot.status === 'over'

  return (
    <div className="app-shell screen--rain">
      {/* 모바일(≤768px)에서는 HUD+방어 게이지가 게임판 위에 반투명하게 뜨는
       * 오버레이 한 덩어리가 된다 — 참고 영상의 다른 앱처럼 별도 바가
       * 공간을 차지하지 않아서, 키보드가 떠도 낙하 영역이 훨씬 넓게
       * 남는다. 데스크톱에서는 display: contents로 이 래퍼 자체가
       * 없는 것처럼 동작해서 예전 그대로 보인다. */}
      <div className="rain-topbar">
      <header className="rain-hud">
        <div className="rain-hud__inner">
          <div className="rain-score">
            <small>
              SCORE <b className="hud-difficulty">{difficulty}</b>
            </small>
            <strong>{snapshot.score.toLocaleString()}</strong>
            {snapshot.combo > 0 ? (
              <span>
                <ZapIcon size={9} />
                COMBO {snapshot.combo}
                {snapshot.multiplier > 1 ? ` ×${snapshot.multiplier}` : ''}
              </span>
            ) : null}
          </div>

          <div className="stage-pill">
            <small>STAGE</small>
            <strong>{snapshot.stage}</strong>
            {snapshot.stageTarget ? (
              <em>
                {snapshot.stageCorrect}/{snapshot.stageTarget}
              </em>
            ) : (
              <em>무한</em>
            )}
          </div>

          <button className="icon-button" onClick={pause} aria-label="일시정지">
            <PauseIcon size={15} className="pause-bars" />
          </button>
        </div>
      </header>

      {/* 모바일에서만 보인다(desktop-topbar 참고 주석) — 데스크톱에서는
       * .rain-dock 안의 원본 방어 게이지만 그대로 보인다. */}
      <DefenseGauge defense={snapshot.defense} tone={tone} variant="board" />
      </div>

      {/* 플레이 내내 참조하는 안내라 각주가 아니라 읽히는 크기의 띠로 둔다 */}
      <p className="rain-legend">
        <span>
          <i className="legend-dot legend-dot--green" />
          북한말이면 <b>남한말</b> 입력
        </span>
        <span>
          <i className="legend-dot legend-dot--yellow" />
          남한말이면 <b>북한말</b> 입력
        </span>
        <span>
          <i className="legend-dot legend-dot--red" />
          <b>시간정지</b> '시간정지' 입력 → 5초간 화면이 멈춰요
        </span>
      </p>

      <div className="fall-field">
        <div className="field-grid" aria-hidden="true" />

        {snapshot.words.map((word) => (
          <div
            key={word.key}
            className={`falling-word falling-word--${
              word.isTimeStop ? 'red' : word.promptSide === 'north' ? 'green' : 'yellow'
            }${snapshot.isTimeStopped ? ' is-frozen' : ''}`}
            style={{
              left: `${word.x}%`,
              // 진행률 기준이라 화면 높이가 바뀌어도 위치가 튀지 않는다.
              top: `calc(${word.progress} * (100% - var(--rain-play-bottom, 0px) - 34px))`,
            }}
          >
            {/* 북/남 배지는 쓰지 않는다(상세기획서 4-1). 색과 모양으로만 구분한다. */}
            <strong>{word.prompt}</strong>
          </div>
        ))}

        <div className="warning-line" aria-hidden="true">
          <span>DEFENSE LINE</span>
        </div>

        {snapshot.isTimeStopped ? (
          <div className="time-stop-overlay" role="status">
            <strong>{Math.ceil(snapshot.timeStopRemaining)}</strong>
            <small>시간 정지 · 멈춘 단어를 정리하세요</small>
            <div className="time-stop-track">
              <span style={{ width: `${(snapshot.timeStopRemaining / TIME_STOP_DURATION) * 100}%` }} />
            </div>
          </div>
        ) : null}

        {snapshot.bannerStage !== null ? (
          <div className="stage-banner" role="status">
            <strong>STAGE {snapshot.bannerStage}</strong>
            <small>속도가 빨라집니다</small>
          </div>
        ) : null}

        {snapshot.feedback ? (
          <div
            key={snapshot.feedback.id}
            className={`rain-feedback rain-feedback--${snapshot.feedback.kind}`}
            role="status"
          >
            {snapshot.feedback.message}
          </div>
        ) : null}
      </div>

      <div className="rain-dock">
        <form className="answer-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="rain-input">
            떨어지는 단어 입력
          </label>
          <input
            id="rain-input"
            ref={inputRef}
            value={input}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="떨어지는 단어의 짝을 입력하세요"
            onChange={(event) => setInput(event.target.value)}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.nativeEvent.isComposing || event.keyCode === 229)
              ) {
                event.preventDefault()
              }
            }}
            disabled={isPaused || counting || isGameOver}
          />
          <button
            type="submit"
            className="button button--primary"
            disabled={isPaused || counting || isGameOver}
          >
            입력
          </button>
        </form>

        <DefenseGauge defense={snapshot.defense} tone={tone} />
      </div>

      {counting && !hasDataError ? (
        <Countdown
          onDone={handleStart}
          seconds={3}
          hint={
            <div className="countdown-guide">
              <span>
                <i className="legend-dot legend-dot--green" />
                <span>
                  초록색 <b>북한말</b>이 떨어지면 뜻이 같은 <b>남한말</b>을 입력
                </span>
              </span>
              <span>
                <i className="legend-dot legend-dot--yellow" />
                <span>
                  노란색 <b>남한말</b>이 떨어지면 뜻이 같은 <b>북한말</b>을 입력
                </span>
              </span>
              <span>
                <i className="legend-dot legend-dot--red" />
                <span>
                  빨간색 <b>시간정지</b>는 <b>글자 그대로</b> 입력하면 5초간 멈춰요
                </span>
              </span>
            </div>
          }
        />
      ) : null}

      {hasDataError ? (
        <GameOverlayMessage
          variant="alert"
          title="단어 데이터를 불러오지 못했어요"
          description="선택한 난이도의 산성비 단어가 없습니다. 메인에서 다시 시도해 주세요."
          onGoHome={() => navigate('/')}
        />
      ) : null}

      {isGameOver ? <GameOverOverlay score={snapshot.score} /> : null}

      {isPaused ? (
        <GamePauseOverlay
          score={snapshot.score}
          statusLine={<>스테이지 {snapshot.stage}</>}
          onResume={() => {
            engine.resume()
            focusInputSoon(inputRef)
          }}
          onRestart={() => setRestartKey((key) => key + 1)}
          onGoHome={() => navigate('/')}
          goHomeLabel="메인으로 나가기"
        />
      ) : null}
    </div>
  )
}
