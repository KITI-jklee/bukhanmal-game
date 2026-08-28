import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '../lib/router'
import { AppFooter } from '../components/AppFooter'
import { NicknameDialog } from '../components/NicknameDialog'
import { CloseIcon, TrophyIcon, ZapIcon } from '../components/Icons'
import { submitScore } from '../lib/rankingApi'
import { getNickname } from '../lib/storage'
import {
  isAcidRainResult,
  isChosungResult,
  type AcidRainResult,
  type ChosungResult,
  type ScoreSubmitResult,
} from '../lib/types'
import { QUESTIONS_PER_ROUND } from '../game/chosungConfig'
import './Result.css'

/** 점수 구간별 상단 배지 문구 */
function gradeLabel(result: AcidRainResult | ChosungResult): string {
  if (result.game === 'chosung') {
    if (result.correctCount >= QUESTIONS_PER_ROUND) return 'PERFECT!'
    if (result.correctCount >= 8) return 'AMAZING!'
    if (result.correctCount >= 6) return 'GREAT!'
    if (result.correctCount >= 3) return 'GOOD!'
    return 'NICE TRY'
  }
  if (result.stageReached >= 3) return 'AMAZING!'
  if (result.stageReached >= 2) return 'GREAT!'
  if (result.correctCount >= 5) return 'GOOD!'
  return 'NICE TRY'
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}분 ${rest}초` : `${rest}초`
}

export function Result() {
  const navigate = useNavigate()
  const location = useLocation()
  const acid = isAcidRainResult(location.state) ? location.state : null
  const chosung = isChosungResult(location.state) ? location.state : null
  const result: AcidRainResult | ChosungResult | null = acid ?? chosung

  // 결과 화면 진입 시점의 저장된 닉네임 — 다이얼로그 프리필용으로만 쓰고 이후 바뀌지 않는다.
  const [storedNickname] = useState(() => getNickname())
  const [nickname, setNicknameState] = useState<string | null>(null)
  const [showNicknameDialog, setShowNicknameDialog] = useState(true)
  const [rank, setRank] = useState<ScoreSubmitResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showAllMissed, setShowAllMissed] = useState(false)
  // 결과 화면에서 1회만 등록한다(C-1).
  const submittedRef = useRef(false)

  const register = useCallback(
    async (player: string) => {
      if (submittedRef.current || !result) return
      submittedRef.current = true
      setSubmitError(null)
      try {
        const response = await submitScore(
          result.game === 'chosung'
            ? {
                nickname: player,
                game: 'chosung',
                difficulty: result.difficulty,
                score: result.score,
                correct_count: result.correctCount,
                no_hint_correct_count: result.noHintCorrectCount,
                max_combo: result.maxCombo,
              }
            : {
                nickname: player,
                game: 'acid_rain',
                difficulty: result.difficulty,
                score: result.score,
                correct_count: result.correctCount,
                stage_reached: result.stageReached,
                max_combo: result.maxCombo,
                time_stop_uses: result.timeStopUses,
                time_stop_clears: result.timeStopClears,
                play_time_seconds: result.playTimeSeconds,
              },
        )
        setRank(response)
      } catch (error) {
        submittedRef.current = false
        setSubmitError(error instanceof Error ? error.message : '점수 등록에 실패했어요.')
      }
    },
    [result],
  )

  useEffect(() => {
    if (nickname) void register(nickname)
  }, [nickname, register])

  // 새로고침 등으로 결과 데이터가 없으면 메인으로 돌려보낸다
  if (!result) {
    return (
      <div className="app-shell screen--result">
        <div className="result-empty">
          <p>표시할 결과가 없어요.</p>
          <button className="button button--primary" onClick={() => navigate('/')}>
            메인으로
          </button>
        </div>
      </div>
    )
  }

  // 복습 노트에 올릴 항목: 산성비는 놓친 단어, 초성은 못 맞힌 문제
  const reviewItems =
    result.game === 'chosung'
      ? result.questions
          .filter((log) => log.outcome !== '정답')
          .map((log) => ({
            key: log.id,
            side: '북한말',
            sideTone: 'north' as const,
            prompt: log.word,
            // 남한말 대응어가 없는 단어(2026-08-11 이후 정상 출제 대상)는 "남한말" 라벨 자체를 보여줄 게 없어서 detail을 통째로 비운다.
            detail: log.southExpression.trim() ? `남한말 · ${log.southExpression}` : null,
            tag: log.outcome,
          }))
      : result.missed.map((word, index) => ({
          key: `${word.id}-${index}`,
          side: word.promptSide === 'north' ? '북한말' : '남한말',
          sideTone: word.promptSide,
          prompt: word.prompt,
          detail: `${word.promptSide === 'north' ? '남한말' : '북한말'} · ${word.answer}`,
          tag: word.reason,
        }))
  const visibleItems = showAllMissed ? reviewItems : reviewItems.slice(0, 3)
  const hiddenCount = reviewItems.length - visibleItems.length
  const gamePath = result.game === 'chosung' ? '/chosung' : '/acid-rain'

  return (
    <div className="app-shell screen--result">
      <header className="result-topbar">
        <span />
        <span>게임 결과</span>
        <button className="icon-button" onClick={() => navigate('/')} aria-label="메인으로">
          <CloseIcon size={16} />
        </button>
      </header>

      <main className="result-content">
        <section className="result-summary">
          <span className="result-badge">
            <TrophyIcon size={16} />
            <span>{gradeLabel(result)}</span>
          </span>
          <p>
            {result.game === 'chosung' ? '북한말 초성게임' : '남북한말 산성비게임'} ·{' '}
            {result.difficulty}
          </p>
          <h3>
            {result.score.toLocaleString()}
            <span>점</span>
          </h3>

          {result.game === 'chosung' ? (
            <>
              {/* 총점은 합계에 난이도 배수를 한 번 적용해 만든다(FR-CH-10).
                  점수가 어떻게 나왔는지 보이도록 계산식을 그대로 노출한다. */}
              <p className="score-formula">
                기본 합계 {result.rawScore.toLocaleString()}점 × 난이도{' '}
                {result.multiplier.toFixed(1)}배
              </p>

              <div className="stat-grid">
                <div className="stat-item stat-item--highlight">
                  <strong>
                    {result.correctCount}
                    <em>/{QUESTIONS_PER_ROUND}</em>
                  </strong>
                  <small>맞힌 문제</small>
                </div>
                <div className="stat-item">
                  <strong>{result.maxCombo}</strong>
                  <small>최고 콤보</small>
                </div>
                <div className="stat-item">
                  <strong>{result.noHintCorrectCount}</strong>
                  <small>무힌트 정답</small>
                </div>
              </div>

              <div className="stat-grid stat-grid--sub">
                <div className="stat-item">
                  <strong>{formatDuration(result.playTimeSeconds)}</strong>
                  <small>플레이 시간</small>
                </div>
                <div className="stat-item">
                  <strong>
                    <ZapIcon size={12} /> {result.hintsUsed}
                  </strong>
                  <small>사용한 힌트</small>
                </div>
                <div className="stat-item">
                  <strong>{result.rawScore.toLocaleString()}</strong>
                  <small>배수 적용 전</small>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="stat-grid">
                <div className="stat-item stat-item--highlight">
                  <strong>{result.stageReached}</strong>
                  <small>도달 스테이지</small>
                </div>
                <div className="stat-item">
                  <strong>{result.maxCombo}</strong>
                  <small>최고 콤보</small>
                </div>
                <div className="stat-item">
                  <strong>{result.correctCount}</strong>
                  <small>맞힌 단어</small>
                </div>
              </div>

              <div className="stat-grid stat-grid--sub">
                <div className="stat-item">
                  <strong>{formatDuration(result.playTimeSeconds)}</strong>
                  <small>생존 시간</small>
                </div>
                <div className="stat-item">
                  <strong>
                    <ZapIcon size={12} /> {result.timeStopUses}
                  </strong>
                  <small>시간정지 획득</small>
                </div>
                <div className="stat-item">
                  <strong>{result.timeStopClears}</strong>
                  <small>정지 중 제거</small>
                </div>
              </div>
            </>
          )}

          {rank ? (
            <div className="rank-callout">
              <TrophyIcon size={14} />
              <span>내 순위</span>
              <strong>
                전체 {rank.total_players.toLocaleString()}명 중 <b>{rank.rank}위</b>
              </strong>
            </div>
          ) : submitError ? (
            <div className="rank-callout rank-callout--error">
              <span>{submitError}</span>
              <strong>
                <button
                  className="text-action"
                  onClick={() =>
                    nickname ? void register(nickname) : setShowNicknameDialog(true)
                  }
                >
                  {nickname ? '다시 시도' : '닉네임 등록'}
                </button>
              </strong>
            </div>
          ) : (
            <div className="rank-callout rank-callout--pending">
              <span>순위 계산 중…</span>
            </div>
          )}
        </section>

        <section className="review-card">
          <div className="review-head">
            <div>
              <span>복습 노트</span>
              <h4>
                {result.game === 'chosung' ? '못 맞힌 문제' : '놓친 단어'}{' '}
                <b>{reviewItems.length}</b>
              </h4>
            </div>
          </div>

          {reviewItems.length === 0 ? (
            <p className="review-empty">
              {result.game === 'chosung'
                ? '10문제를 모두 맞혔어요. 완벽합니다!'
                : '놓친 단어가 없어요. 완벽한 방어였습니다!'}
            </p>
          ) : (
            <>
              <div className="missed-list">
                {visibleItems.map((item) => (
                  <div className="missed-item" key={item.key}>
                    <span className={`missed-side missed-side--${item.sideTone}`}>{item.side}</span>
                    <div>
                      <strong>{item.prompt}</strong>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </div>
                    <span className="missed-tag">{item.tag}</span>
                  </div>
                ))}
              </div>
              {hiddenCount > 0 ? (
                <button className="more-link" onClick={() => setShowAllMissed(true)}>
                  {hiddenCount}개 더 보기
                </button>
              ) : null}
            </>
          )}
        </section>

        <div className="result-actions">
          <button
            className="button button--primary"
            onClick={() =>
              navigate(`${gamePath}?difficulty=${encodeURIComponent(result.difficulty)}`, {
                replace: true,
              })
            }
          >
            다시하기
          </button>
          <button className="button button--outline" onClick={() => navigate('/')}>
            메인으로
          </button>
          <button
            className="button button--ghost"
            onClick={() =>
              navigate(
                `/ranking?game=${result.game}&difficulty=${encodeURIComponent(result.difficulty)}`,
              )
            }
          >
            랭킹 보기
          </button>
        </div>
      </main>

      <AppFooter />

      {showNicknameDialog ? (
        <NicknameDialog
          initialValue={storedNickname ?? ''}
          onDone={(value) => {
            setNicknameState(value)
            setShowNicknameDialog(false)
          }}
          // 이미 닉네임이 있는 사용자는 확인·수정만 하는 것이라 건너뛸 이유가 없다 — "다음에 하기"는 아직 닉네임이 없는 첫 사용자에게만 준다.
          onSkip={
            storedNickname
              ? undefined
              : () => {
                  setShowNicknameDialog(false)
                  setSubmitError('닉네임을 등록하지 않아 이번 점수는 랭킹에 기록되지 않았어요.')
                }
          }
        />
      ) : null}
    </div>
  )
}
