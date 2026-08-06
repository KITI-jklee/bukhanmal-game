import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from '../lib/router'
import { Countdown } from '../components/Countdown'
import { BookIcon, BulbIcon, HeartIcon, PauseIcon, ZapIcon } from '../components/Icons'
import { ChosungEngine, type ChosungSnapshot } from '../game/ChosungEngine'
import { HINT_SCORE, MAX_WRONG, TIME_LIMIT_SECONDS, particleFor } from '../game/chosungConfig'
import words from '../data/chosung_words.json'
import type { ChosungWord, Difficulty } from '../lib/types'
import { normalizeDifficulty } from '../lib/types'
import { useAutoPause } from '../lib/useViewport'
import './Chosung.css'

const ALL_WORDS = words as ChosungWord[]

export function Chosung() {
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
  const engine = useMemo(() => new ChosungEngine(ALL_WORDS, difficulty), [difficulty, restartKey])

  const [snapshot, setSnapshot] = useState<ChosungSnapshot>(() => engine.snapshot())
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

  // 시간 초과 등으로 다음 문제가 출제되면 이전 문제에서 입력하던 값을 비운다.
  useEffect(() => {
    setInput('')
  }, [snapshot.questionNumber])

  useEffect(() => {
    if (counting || snapshot.status !== 'playing' || snapshot.reveal) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [counting, snapshot.status, snapshot.reveal])

  // 10문제를 마치면 결과 화면으로
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

  const isPaused = snapshot.status === 'paused'
  const hasDataError = snapshot.status === 'error'
  const blocked = isPaused || counting || snapshot.reveal !== null
  const hintsLeft = snapshot.maxHintLevel - snapshot.hintLevel
  const nextHintScore = HINT_SCORE[Math.min(snapshot.hintLevel + 1, HINT_SCORE.length - 1)]

  return (
    <div className="app-shell screen--quiz">
      <header className="quiz-hud">
        <div className="quiz-hud__inner">
          <div className="quiz-score">
            <small>
              SCORE <b className="hud-difficulty">{difficulty}</b>
            </small>
            <strong>{snapshot.score.toLocaleString()}</strong>
            {snapshot.combo > 0 ? (
              <span>
                <ZapIcon size={9} />
                COMBO {snapshot.combo}
              </span>
            ) : null}
          </div>

          <div className="quiz-progress">
            <span>
              문제 {snapshot.questionNumber} <i>/ {snapshot.totalQuestions}</i>
            </span>
            <div className="timer-bar">
              <span
                className={snapshot.remainingSeconds <= 5 ? 'is-urgent' : undefined}
                style={{ width: `${snapshot.timeProgress * 100}%` }}
              />
            </div>
            <strong className={snapshot.remainingSeconds <= 5 ? 'is-urgent' : undefined}>
              {snapshot.remainingSeconds}초
            </strong>
          </div>

          <button className="icon-button" onClick={pause} aria-label="일시정지">
            <PauseIcon size={15} className="pause-bars" />
          </button>
        </div>
      </header>

      <div className="chance-row">
        <div className="chance-group" aria-label={`남은 기회 ${snapshot.hearts}개`}>
          <span>기회</span>
          {Array.from({ length: MAX_WRONG }, (_, i) => (
            <HeartIcon key={i} size={15} filled={i < snapshot.hearts} />
          ))}
        </div>
        <div
          className="chance-group chance-group--hint"
          aria-label={`남은 힌트 ${hintsLeft}개`}
        >
          <span>힌트</span>
          {/* 왼쪽 전구부터 하나씩 꺼진다 (상세 3-3) */}
          {Array.from({ length: snapshot.maxHintLevel }, (_, i) => (
            <BulbIcon key={i} size={15} filled={i >= snapshot.hintLevel} />
          ))}
        </div>
      </div>

      <main className="quiz-stage">
        <div className="question-card">
          <span className="question-label">이 말은 무엇일까요?</span>
          <strong className="initial-letters">{snapshot.initials.split('').join(' ')}</strong>

          <div className="definition">
            <BookIcon size={15} />
            <p>{snapshot.meaning}</p>
          </div>

          {snapshot.southHint ? (
            <p className="south-hint">
              우리가 흔히 쓰는 <b>{snapshot.southHint}</b>
              {particleFor(snapshot.southHint, '을', '를')} 북한에서는 이렇게 부릅니다
            </p>
          ) : null}

        </div>
      </main>

      <div className="answer-dock">
        <button
          className="hint-button"
          onClick={() => engine.useHint()}
          disabled={blocked || hintsLeft === 0}
        >
          <BulbIcon size={13} filled={hintsLeft > 0} />
          힌트 보기
          <span>
            {hintsLeft > 0 ? `${hintsLeft}개 남음 · 정답 시 ${nextHintScore}점` : '모두 사용함'}
          </span>
        </button>

        <form className="answer-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chosung-input">
            정답 입력
          </label>
          <input
            id="chosung-input"
            ref={inputRef}
            value={input}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="정답 입력"
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
            disabled={blocked}
          />
          <button type="submit" className="button button--primary" disabled={blocked}>
            제출
          </button>
        </form>

        <p className="dock-note">
          {snapshot.feedback ? (
            <span key={snapshot.feedback.id} className={`quiz-feedback quiz-feedback--${snapshot.feedback.kind}`}>
              {snapshot.feedback.message}
            </span>
          ) : (
            'Enter를 눌러도 제출할 수 있어요'
          )}
        </p>
      </div>

      {snapshot.reveal ? (
        <div className="overlay">
          <div
            className={`reveal-card reveal-card--${
              snapshot.reveal.outcome === '정답' ? 'correct' : 'wrong'
            }`}
            role="status"
          >
            <span className="reveal-kicker">
              {snapshot.reveal.outcome === '정답'
                ? '정답이에요!'
                : snapshot.reveal.outcome === '시간 초과'
                  ? 'TIME OUT!'
                  : '아쉬워요'}
            </span>
            <strong className="reveal-word">{snapshot.reveal.word}</strong>
            <p className="reveal-meaning">{snapshot.reveal.meaning}</p>
            <p className="reveal-south">
              <span>남한말</span>
              <b>{snapshot.reveal.southExpression}</b>
            </p>

            <div className="reveal-score">
              {snapshot.reveal.outcome === '정답' ? (
                <>
                  <span>+{snapshot.reveal.earned}점</span>
                  {snapshot.reveal.comboBonus > 0 ? (
                    <em>콤보 보너스 +{snapshot.reveal.comboBonus}점</em>
                  ) : null}
                </>
              ) : (
                <span className="is-zero">0점</span>
              )}
            </div>

            <button className="button button--primary reveal-next-button" onClick={() => engine.next()}>
              {snapshot.questionNumber >= snapshot.totalQuestions ? '결과 보기' : '다음 문제'}
            </button>
          </div>
        </div>
      ) : null}

      {counting && !hasDataError ? (
        <Countdown
          onDone={handleStart}
          seconds={3}
          hint={
            <div className="countdown-guide">
              <span>
                <i className="legend-dot legend-dot--green" />
                <span>
                  <b>초성과 뜻풀이</b>를 보고 북한말을 입력하세요
                </span>
              </span>
              <span>
                <i className="legend-dot legend-dot--yellow" />
                <span>
                  문제당 <b>{TIME_LIMIT_SECONDS}초</b>, 오답 기회 <b>{MAX_WRONG}번</b>
                </span>
              </span>
              <span>
                <i className="legend-dot legend-dot--red" />
                <span>
                  힌트를 쓰면 점수가 <b>10 → 5 → 2점</b>으로 낮아져요
                </span>
              </span>
            </div>
          }
        />
      ) : null}

      {hasDataError ? (
        <div className="overlay">
          <div className="overlay-card" role="alertdialog" aria-modal="true">
            <h3>문제 데이터를 불러오지 못했어요</h3>
            <p>선택한 난이도의 초성 문제가 없습니다. 메인에서 다시 시도해 주세요.</p>
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
              점수 {snapshot.score.toLocaleString()}점 · 문제 {snapshot.questionNumber}/
              {snapshot.totalQuestions}
              <br />
              준비되면 이어서 진행하세요.
            </p>
            <div className="overlay-actions">
              <button className="button button--primary" onClick={() => engine.resume()}>
                이어하기
              </button>
              <button
                className="button button--outline"
                onClick={() => setRestartKey((key) => key + 1)}
              >
                다시 시작하기
              </button>
              <button className="button button--ghost" onClick={() => navigate('/')}>
                메인으로
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
