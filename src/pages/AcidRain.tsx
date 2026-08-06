import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from '../lib/router'
import { Countdown } from '../components/Countdown'
import { PauseIcon, ShieldIcon, ZapIcon } from '../components/Icons'
import { AcidRainEngine, type EngineSnapshot } from '../game/AcidRainEngine'
import { DEFENSE_MAX, TIME_STOP_DURATION, defenseTone } from '../game/acidRainConfig'
import pairs from '../data/acidrain_pairs.json'
import type { AcidRainPair, Difficulty } from '../lib/types'
import { normalizeDifficulty } from '../lib/types'
import { useAutoPause } from '../lib/useViewport'
import './AcidRain.css'

const ALL_PAIRS = pairs as AcidRainPair[]

export function AcidRain() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const difficulty = useMemo<Difficulty>(() => {
    return normalizeDifficulty(params.get('difficulty')) ?? '보통'
  }, [params])

  // 일시정지 중 "다시 시작하기"를 누르면 값을 올려 엔진을 새로 만든다.
  // difficulty만 의존성이면 같은 난이도로는 재생성이 안 돼(리액트가 같은
  // 컴포넌트를 그대로 재사용) 재시작이 안 걸린다.
  const [restartKey, setRestartKey] = useState(0)
  // restartKey는 콜백 안에서 안 쓰지만, 값을 올려 강제로 새 엔진을
  // 만들게 하는 재시작 트리거라 의존성 배열에 일부러 넣어둔다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const engine = useMemo(() => new AcidRainEngine(ALL_PAIRS, difficulty), [difficulty, restartKey])

  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => engine.snapshot())
  const [counting, setCounting] = useState(true)
  const [input, setInput] = useState('')
  const composingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => engine.subscribe(setSnapshot), [engine])
  useEffect(() => () => engine.destroy(), [engine])
  useEffect(() => {
    setSnapshot(engine.snapshot())
    setCounting(true)
    setInput('')
  }, [engine])

  // 시작·이어하기로 입력창이 다시 활성화된 다음 자동으로 포커스를 복원한다.
  useEffect(() => {
    if (counting || snapshot.status !== 'playing') return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [counting, snapshot.status])

  // 방어 게이지가 0이 되면 결과 화면으로 (FR-AR-08)
  useEffect(() => {
    if (snapshot.status !== 'over') return
    navigate('/result', { replace: true, state: engine.buildResult() })
  }, [snapshot.status, engine, navigate])

  const pause = useCallback(() => engine.pause(), [engine])
  useAutoPause(pause, snapshot.status === 'playing')

  const handleStart = useCallback(() => {
    setCounting(false)
    engine.start()
    inputRef.current?.focus()
  }, [engine])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    // 한글 조합 중인 입력은 판정하지 않는다 (FR-CM-06)
    if (composingRef.current) return
    engine.submit(input)
    setInput('')
  }

  const tone = defenseTone(snapshot.defense)
  const isPaused = snapshot.status === 'paused'
  const hasDataError = snapshot.status === 'error'

  return (
    <div className="app-shell screen--rain">
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
              top: `calc(${word.progress} * (100% - 34px))`,
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
