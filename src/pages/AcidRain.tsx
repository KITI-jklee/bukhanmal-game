import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from '../lib/router'
import { Countdown } from '../components/Countdown'
import { PauseIcon, ShieldIcon, ZapIcon } from '../components/Icons'
import { AcidRainEngine, type EngineSnapshot } from '../game/AcidRainEngine'
import {
  DEFENSE_MAX,
  MOBILE_FALL_DURATION_SCALE,
  TIME_STOP_DURATION,
  defenseTone,
} from '../game/acidRainConfig'
import type { AcidRainPair, Difficulty } from '../lib/types'
import { normalizeDifficulty } from '../lib/types'
import { useGameData } from '../lib/useGameData'
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
  // difficulty만 의존성이면 같은 난이도로는 재생성이 안 돼(리액트가 같은
  // 컴포넌트를 그대로 재사용) 재시작이 안 걸린다.
  const [restartKey, setRestartKey] = useState(0)
  // 단어 데이터가 fetch로 아직 도착하지 않았으면 엔진을 만들지 않는다.
  // restartKey는 콜백 안에서 안 쓰지만, 값을 올려 강제로 새 엔진을
  // 만들게 하는 재시작 트리거라 의존성 배열에 일부러 넣어둔다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const engine = useMemo(
    () =>
      allPairs
        ? new AcidRainEngine(
            allPairs,
            difficulty,
            window.matchMedia('(max-width: 768px)').matches ? MOBILE_FALL_DURATION_SCALE : 1,
          )
        : null,
    // restartKey는 새 엔진 생성을 강제하는 트리거다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPairs, difficulty, restartKey],
  )

  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(() => engine?.snapshot() ?? null)
  const [counting, setCounting] = useState(true)
  const [input, setInput] = useState('')
  const composingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const answerFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!engine) return
    return engine.subscribe(setSnapshot)
  }, [engine])
  useEffect(() => {
    if (!engine) return
    return () => engine.destroy()
  }, [engine])

  // 오답·놓침 피드백 강화 — 화면 흔들림 + (지원 기기에서) 진동. shake는
  // .shake에 애니메이션이 걸린 CSS가 모바일 전용 미디어 쿼리 안에만
  // 있어서 데스크톱에서는 클래스만 붙었다 떨어질 뿐 아무 효과가 없다.
  useEffect(() => {
    if (snapshot?.feedback?.kind !== 'wrong' && snapshot?.feedback?.kind !== 'miss') return
    const el = answerFormRef.current
    if (el) {
      el.classList.remove('shake')
      void el.offsetWidth // 강제 리플로우 — 같은 애니메이션이 처음부터 다시 재생되게 함
      el.classList.add('shake')
    }
    navigator.vibrate?.(120)
  }, [snapshot?.feedback])

  useEffect(() => {
    if (!engine) return
    setSnapshot(engine.snapshot())
    setCounting(true)
    setInput('')
  }, [engine])

  // 시작·이어하기로 입력창이 다시 활성화된 다음 자동으로 포커스를 복원한다.
  // requestAnimationFrame이 아니라 setTimeout을 쓴다 — 탭이 백그라운드로
  // 밀리는 등 화면이 실제로 그려지지 않는 순간에는 rAF 콜백 자체가 브라우저
  // 정책상 멈춰서 포커스 복원이 씹힐 수 있다. setTimeout은 그런 상태와
  // 무관하게 항상 실행된다.
  useEffect(() => {
    if (counting || snapshot?.status !== 'playing') return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [counting, snapshot?.status])

  // 방어 게이지가 0이 되면 결과 화면으로 (FR-AR-08)
  useEffect(() => {
    if (!engine || snapshot?.status !== 'over') return
    navigate('/result', { replace: true, state: engine.buildResult() })
  }, [snapshot?.status, engine, navigate])

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
    // 엔터 제출 때는 입력창이 이미 활성화돼 있으므로 다시 focus하면 iOS가
    // 화면을 위아래로 재스크롤한다. 버튼 제출 등 실제로 포커스가 빠진
    // 경우에만 스크롤 없이 복원해 키보드를 유지한다.
    window.setTimeout(() => {
      const inputElement = inputRef.current
      if (inputElement && document.activeElement !== inputElement) {
        inputElement.focus({ preventScroll: true })
      }
    }, 0)
  }

  if (loadError) {
    return (
      <div className="app-shell screen--rain">
        <div className="overlay">
          <div className="overlay-card" role="alertdialog" aria-modal="true">
            <h3>단어 데이터를 불러오지 못했어요</h3>
            <p>네트워크 상태를 확인한 뒤 메인에서 다시 시도해 주세요.</p>
            <button className="button button--primary" onClick={() => navigate('/')}>
              메인으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!engine || !snapshot) {
    return (
      <div className="app-shell screen--rain">
        <div className="overlay">
          <div className="overlay-card" role="status" aria-live="polite">
            <h3>단어를 불러오는 중이에요</h3>
            <p>잠시만 기다려 주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  const tone = defenseTone(snapshot.defense)
  const isPaused = snapshot.status === 'paused'
  const hasDataError = snapshot.status === 'error'

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
      <div className="defense-meter defense-meter--board">
        <div className="defense-label">
          <span>
            <ShieldIcon size={11} /> 방어 게이지
          </span>
          <strong>{snapshot.defense}%</strong>
        </div>
        <div className={`defense-track defense-track--${tone}`}>
          <span style={{ width: `${(snapshot.defense / DEFENSE_MAX) * 100}%` }} />
        </div>
      </div>
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
              // 34px는 단어 박스의 실제 렌더링 높이(모바일 31px~데스크톱 35px)에
              // 맞춘 값이다 — progress가 1(놓침 판정)이 되는 순간 박스의 아래쪽
              // 끝이 정확히 컨테이너 바닥(DEFENSE LINE)에 닿아야 눈으로 보는
              // 소멸 위치와 실제 판정 위치가 일치한다.
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
        <form className="answer-form" ref={answerFormRef} onSubmit={handleSubmit}>
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
            disabled={isPaused || counting}
          />
          <button type="submit" className="button button--primary" disabled={isPaused || counting}>
            입력
          </button>
        </form>

        <div className="defense-meter">
          <div className="defense-label">
            <span>
              <ShieldIcon size={11} /> 방어 게이지
            </span>
            <strong>{snapshot.defense}%</strong>
          </div>
          <div className={`defense-track defense-track--${tone}`}>
            <span style={{ width: `${(snapshot.defense / DEFENSE_MAX) * 100}%` }} />
          </div>
        </div>
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
        <div className="overlay">
          <div className="overlay-card" role="alertdialog" aria-modal="true">
            <h3>단어 데이터를 불러오지 못했어요</h3>
            <p>선택한 난이도의 산성비 단어가 없습니다. 메인에서 다시 시도해 주세요.</p>
            <button className="button button--primary" onClick={() => navigate('/')}>
              메인으로
            </button>
          </div>
        </div>
      ) : null}

      {isPaused ? (
        <div className="overlay">
          <div className="overlay-card" role="dialog" aria-modal="true" aria-label="일시정지">
            <h3>잠시 멈췄어요</h3>
            <p>
              점수 {snapshot.score.toLocaleString()}점 · 스테이지 {snapshot.stage}
              <br />
              준비되면 이어서 진행하세요.
            </p>
            <div className="overlay-actions">
              <button
                className="button button--primary"
                onClick={() => {
                  engine.resume()
                  window.setTimeout(() => inputRef.current?.focus(), 0)
                }}
              >
                이어하기
              </button>
              <button
                className="button button--outline"
                onClick={() => setRestartKey((key) => key + 1)}
              >
                다시 시작하기
              </button>
              <button className="button button--ghost" onClick={() => navigate('/')}>
                메인으로 나가기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
