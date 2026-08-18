import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from '../lib/router'
import { Countdown } from '../components/Countdown'
import { BookIcon, BulbIcon, HeartIcon, PauseIcon, ZapIcon } from '../components/Icons'
import { ChosungEngine, type ChosungSnapshot } from '../game/ChosungEngine'
import { HINT_SCORE, MAX_WRONG, TIME_LIMIT_SECONDS, particleFor } from '../game/chosungConfig'
import type { ChosungWord, Difficulty } from '../lib/types'
import { normalizeDifficulty } from '../lib/types'
import { useGameData } from '../lib/useGameData'
import { useAutoPause, useLockBodyScroll } from '../lib/useViewport'
import './Chosung.css'

const DATA_URL = `${import.meta.env.BASE_URL}data/chosung_words.json`

export function Chosung() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: allWords, error: loadError } = useGameData<ChosungWord[]>(DATA_URL)

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
    () => (allWords ? new ChosungEngine(allWords, difficulty) : null),
    [allWords, difficulty, restartKey],
  )

  const [snapshot, setSnapshot] = useState<ChosungSnapshot | null>(() => engine?.snapshot() ?? null)
  const [counting, setCounting] = useState(true)
  const [input, setInput] = useState('')
  const composingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 모바일 전용 힌트 팝오버 — 데스크톱은 하단 독의 기존 힌트 보기 버튼을
  // 그대로 쓰고, 이 상태는 절대 true가 되지 않는다(handleHintTap의
  // matchMedia 가드 참고).
  const [hintPopupOpen, setHintPopupOpen] = useState(false)
  const hintPopupTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    return () => {
      if (hintPopupTimerRef.current !== undefined) window.clearTimeout(hintPopupTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!engine) return
    return engine.subscribe(setSnapshot)
  }, [engine])
  useEffect(() => {
    if (!engine) return
    return () => engine.destroy()
  }, [engine])
  useEffect(() => {
    if (!engine) return
    setSnapshot(engine.snapshot())
    setCounting(true)
    setInput('')
  }, [engine])

  // 시간 초과 등으로 다음 문제가 출제되면 이전 문제에서 입력하던 값을 비운다.
  useEffect(() => {
    setInput('')
  }, [snapshot?.questionNumber])

  // 오답 피드백 — (지원 기기에서) 진동. navigator.vibrate는 진동 하드웨어가
  // 없는 데스크톱에서는 조용히 무시된다. 화면을 흔드는 시각 효과는 모바일에서
  // 화면이 움직이는 느낌이 거슬린다는 피드백을 받아 제거했다.
  useEffect(() => {
    if (snapshot?.feedback?.kind !== 'wrong') return
    navigator.vibrate?.(120)
  }, [snapshot?.feedback])

  useEffect(() => {
    if (counting || snapshot?.status !== 'playing' || snapshot.reveal) return
    // requestAnimationFrame이 아니라 setTimeout을 쓴다 — 탭이 백그라운드로
    // 밀리는 등 화면이 실제로 그려지지 않는 순간에는 rAF 콜백 자체가 브라우저
    // 정책상 멈춰서 포커스 복원이 씹힐 수 있다. setTimeout은 그런 상태와
    // 무관하게 항상 실행된다.
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [counting, snapshot?.status, snapshot?.reveal])

  // 10문제를 마치면 결과 화면으로
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

  const handleRevealNext = useCallback(() => {
    if (!engine) return
    engine.next()
    // 다음 문제로 넘어갈 때 입력창 포커스를 되살린다 — 안 하면 이 버튼에
    // 포커스가 남아 모바일에서 키보드가 다시 뜨지 않는다.
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [engine])

  // 정답/오답 모달이 떠 있을 때 Enter를 누르면 "다음 문제" 버튼을 누른 것과
  // 동일하게 다음 문제로 넘어간다. 조합 중 엔터(IME 229)는 무시한다.
  useEffect(() => {
    if (!snapshot?.reveal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return
      event.preventDefault()
      handleRevealNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [snapshot?.reveal, handleRevealNext])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    // 한글 조합 중인 입력은 판정하지 않는다 (FR-CM-06)
    if (composingRef.current || !engine) return
    engine.submit(input)
    setInput('')
    // 엔터 제출 때 이미 활성화된 입력창에 다시 focus하면 iOS가 화면을
    // 위아래로 재스크롤한다. 버튼 제출처럼 실제로 포커스가 빠졌을 때만
    // 스크롤 없이 복원해 산성비게임과 같은 짧은 좌우 흔들림만 남긴다.
    window.setTimeout(() => {
      const inputElement = inputRef.current
      if (inputElement && document.activeElement !== inputElement) {
        inputElement.focus({ preventScroll: true })
      }
    }, 0)
  }

  if (loadError) {
    return (
      <div className="app-shell screen--quiz">
        <div className="overlay">
          <div className="overlay-card" role="alertdialog" aria-modal="true">
            <h3>문제 데이터를 불러오지 못했어요</h3>
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
      <div className="app-shell screen--quiz">
        <div className="overlay">
          <div className="overlay-card" role="status" aria-live="polite">
            <h3>문제를 불러오는 중이에요</h3>
            <p>잠시만 기다려 주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  const isPaused = snapshot.status === 'paused'
  const hasDataError = snapshot.status === 'error'
  const blocked = isPaused || counting || snapshot.reveal !== null
  const hintsLeft = snapshot.maxHintLevel - snapshot.hintLevel
  const nextHintScore = HINT_SCORE[Math.min(snapshot.hintLevel + 1, HINT_SCORE.length - 1)]

  // 뜻풀이가 "① ... ② ..."처럼 여러 뜻으로 나뉘어 있으면 한 줄에 욱여넣지
  // 않고 뜻별로 줄바꿈해서 보여준다(안 그러면 글자 수가 너무 많아져
  // meaning-scale이 지나치게 작아진다).
  const meaningSenses = snapshot.meaning
    .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/)
    .map((sense) => sense.trim())
    .filter(Boolean)

  // 모바일(≤768px)에서만 상단 상태바의 힌트 아이콘을 눌러 힌트를 쓸 수
  // 있게 한다 — 데스크톱은 하단 독의 기존 버튼만 동작해야 하므로, CSS
  // 미디어 쿼리와 같은 기준선을 여기서도 그대로 검사해 데스크톱에서는
  // 아무 일도 안 일어나게 막는다(버튼 자체는 항상 존재하지만 동작은
  // 모바일에서만).
  const handleHintTap = () => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 768px)').matches) return
    if (blocked || hintsLeft === 0) return
    engine.useHint()
    setHintPopupOpen(true)
    if (hintPopupTimerRef.current !== undefined) window.clearTimeout(hintPopupTimerRef.current)
    hintPopupTimerRef.current = window.setTimeout(() => setHintPopupOpen(false), 2400)
  }

  return (
    <div className="app-shell screen--quiz">
      {/* 모바일(≤768px)에서는 HUD+기회띠가 문제 영역 위에 반투명하게 뜨는
       * 오버레이 한 덩어리가 된다 — 참고 영상의 다른 앱처럼 별도 바가
       * 공간을 차지하지 않아서, 키보드가 떠도 문제 카드 영역이 훨씬
       * 넓게 남는다. 데스크톱에서는 display: contents로 이 래퍼 자체가
       * 없는 것처럼 동작해서 예전 그대로 보인다. */}
      <div className="quiz-topbar">
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

      <div className="chance-row chance-row--desktop">
        <div className="chance-group" aria-label={`남은 기회 ${snapshot.hearts}개`}>
          <span>기회</span>
          {Array.from({ length: MAX_WRONG }, (_, i) => (
            <HeartIcon key={i} size={15} filled={i < snapshot.hearts} />
          ))}
        </div>
        <div className="chance-group chance-group--hint">
          <button
            type="button"
            className="hint-trigger"
            aria-label={`남은 힌트 ${hintsLeft}개`}
            onClick={handleHintTap}
          >
            <span className="hint-trigger-label hint-trigger-label--desktop">힌트</span>
            <span className="hint-trigger-label hint-trigger-label--mobile">힌트보기</span>
            {Array.from({ length: snapshot.maxHintLevel }, (_, i) => (
              <BulbIcon key={i} size={15} filled={i >= snapshot.hintLevel} />
            ))}
          </button>
        </div>
      </div>
      </div>

      <main className="quiz-stage">
        <div className="question-card">
          <div className="chance-row chance-row--mobile">
            <div className="chance-group" aria-label={`남은 기회 ${snapshot.hearts}개`}>
              <span>기회</span>
              {Array.from({ length: MAX_WRONG }, (_, i) => (
                <HeartIcon key={i} size={15} filled={i < snapshot.hearts} />
              ))}
            </div>
            <div className="chance-group chance-group--hint">
              <button
                type="button"
                className="hint-trigger"
                aria-label={`남은 힌트 ${hintsLeft}개`}
                onClick={handleHintTap}
              >
                <span className="hint-trigger-label hint-trigger-label--desktop">힌트</span>
                <span className="hint-trigger-label hint-trigger-label--mobile">힌트보기</span>
                {Array.from({ length: snapshot.maxHintLevel }, (_, i) => (
                  <BulbIcon key={i} size={15} filled={i >= snapshot.hintLevel} />
                ))}
              </button>

              {hintPopupOpen ? (
                <div className="hint-popover" role="status">
                  {hintsLeft > 0
                    ? `${hintsLeft}개 남음 · 정답 시 ${nextHintScore}점`
                    : '모두 사용함'}
                </div>
              ) : null}
            </div>
          </div>

          <span className="question-label">이 말은 무엇일까요?</span>
          {/* 초성 5자까지는 기존 크기를 유지하고, 그보다 길면 한 줄에 들어가도록
           * 글자 수에 반비례해 폰트 크기를 줄인다 (최장 8자 단어까지 존재). */}
          <strong
            className="initial-letters"
            style={{ '--initials-scale': Math.min(1, 5 / snapshot.initials.length) } as CSSProperties}
          >
            {snapshot.initials.split('').join(' ')}
          </strong>

          <div
            className="definition"
            style={
              {
                // 뜻풀이가 길어질수록 글자 크기를 줄여 한 줄 안에 들어가게 한다.
                // 32자까지는 기존 크기를 유지하고, 그보다 길면 글자 수에
                // 반비례해 줄어들되 0.72 밑으로는 가독성을 위해 더 줄이지
                // 않는다(그 이상 긴 뜻풀이는 줄바꿈을 허용해 잘리지 않게 둔다).
                // 단, ①②처럼 뜻이 여러 개로 나뉜 경우는 줄바꿈으로 나눠 보여주니
                // 글자 수와 무관하게 원래 크기를 그대로 쓴다.
                '--meaning-scale':
                  meaningSenses.length > 1
                    ? 1
                    : Math.max(0.72, Math.min(1, 32 / snapshot.meaning.length)),
              } as CSSProperties
            }
          >
            <BookIcon size={15} />
            {meaningSenses.length > 1 ? (
              <div className="definition-lines">
                {meaningSenses.map((sense, index) => (
                  <p key={index}>{sense}</p>
                ))}
              </div>
            ) : (
              <p>{snapshot.meaning}</p>
            )}
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
            autoCorrect="off"
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
            <span className="dock-hint-text">Enter를 눌러도 제출할 수 있어요</span>
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
            {snapshot.reveal.southExpression ? (
              <p className="reveal-south">
                <span>남한말</span>
                <b>{snapshot.reveal.southExpression}</b>
              </p>
            ) : null}

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

            <button
              className="button button--primary reveal-next-button"
              onClick={handleRevealNext}
            >
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
                  힌트를 사용하면 <b>획득할 수 있는 점수가 줄어들어요</b>
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
                메인으로
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
