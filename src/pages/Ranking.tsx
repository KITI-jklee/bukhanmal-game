/** 랭킹 화면 — FR-RK-01~06
 *
 * 시안에는 "이번 주 랭킹 / 시즌 08 · D-4" 문구가 있었으나,
 * FR-RK-04는 시즌·주간 리셋 없는 상시 누적 방식이므로 문구를 바로잡았다. */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from '../lib/router'
import { AppFooter } from '../components/AppFooter'
import { AppHeader } from '../components/AppHeader'
import { GamepadIcon, TrophyIcon } from '../components/Icons'
import { fetchRankings, getMyRecentRecords } from '../lib/rankingApi'
import { getNickname } from '../lib/storage'
import {
  DIFFICULTIES,
  normalizeDifficulty,
  type Difficulty,
  type GameId,
  type RankingEntry,
} from '../lib/types'
import './Ranking.css'

const GAMES: { id: GameId; label: string }[] = [
  { id: 'acid_rain', label: '산성비게임' },
  { id: 'chosung', label: '초성게임' },
]

const MEDAL_CLASS = ['ranking-row--master', 'ranking-row--silver', 'ranking-row--bronze']

function isGameId(value: string | null): value is GameId {
  return value !== null && GAMES.some((game) => game.id === value)
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function Ranking() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const gameParam = params.get('game')
  const difficultyParam = params.get('difficulty')
  const game: GameId = isGameId(gameParam) ? gameParam : 'acid_rain'
  const difficulty: Difficulty = normalizeDifficulty(difficultyParam) ?? '보통'
  const selectedGame = GAMES.find((item) => item.id === game)!
  const gamePath = game === 'chosung' ? '/chosung' : '/acid-rain'

  const [entries, setEntries] = useState<RankingEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const nickname = useMemo(() => getNickname(), [])
  const myRecords = useMemo(
    () => (nickname ? getMyRecentRecords(nickname, game, difficulty) : []),
    [nickname, game, difficulty],
  )

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setLoadError(null)
    void fetchRankings(game, difficulty)
      .then((response) => {
        if (!cancelled) setEntries(response.top5)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setEntries([])
        setLoadError(error instanceof Error ? error.message : '랭킹을 불러오지 못했어요.')
      })
    return () => {
      cancelled = true
    }
  }, [game, difficulty, retryCount])

  const update = (next: Partial<{ game: GameId; difficulty: Difficulty }>) => {
    setParams({
      game: next.game ?? game,
      difficulty: next.difficulty ?? difficulty,
    })
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="ranking-content">
        <div className="ranking-title">
          <div>
            <h1>
              <TrophyIcon size={26} />
              명예의 전당
            </h1>
            <p>치열한 순위 경쟁! 1위의 주인공에 도전해 보세요.</p>
          </div>
        </div>

        <div className="ranking-controls">
          <div className="segmented-tabs" role="tablist" aria-label="게임">
            {GAMES.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={game === item.id}
                className={game === item.id ? 'is-active' : undefined}
                onClick={() => update({ game: item.id })}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="level-tabs" role="tablist" aria-label="난이도">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                role="tab"
                aria-selected={difficulty === level}
                className={difficulty === level ? 'is-active' : undefined}
                onClick={() => update({ difficulty: level })}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="ranking-card">
          <div className="ranking-card-head">
            <span>TOP 5</span>
            <small>
              {selectedGame.label} · {difficulty}
            </small>
          </div>

          <div className={`ranking-list${entries?.length === 1 ? ' ranking-list--single' : ''}`}>
            {loadError ? (
              <div className="ranking-empty">
                <p>{loadError}</p>
                <button className="text-action" onClick={() => setRetryCount((count) => count + 1)}>
                  다시 시도
                </button>
              </div>
            ) : entries === null ? (
              <p className="ranking-empty">불러오는 중…</p>
            ) : entries.length === 0 ? (
              <div className="ranking-empty">
                <p>아직 등록된 기록이 없어요. 첫 번째 주인공이 되어보세요!</p>
                <button
                  className="ranking-challenge-button"
                  onClick={() => navigate(`${gamePath}?difficulty=${encodeURIComponent(difficulty)}`)}
                >
                  <GamepadIcon size={18} />
                  <span>{selectedGame.label} 도전하기</span>
                </button>
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={`${entry.rank}-${entry.nickname}`}
                  className={`ranking-row ${MEDAL_CLASS[entry.rank - 1] ?? ''}${
                    entry.nickname === nickname ? ' is-me' : ''
                  }`}
                >
                  <span className="rank-number">
                    {entry.rank <= 3 ? <TrophyIcon size={18} /> : entry.rank}
                  </span>
                  {/* 아바타는 닉네임 첫 글자를 그대로 보여줄 뿐이라 정보가 없다.
                      좁은 화면에서 잘리는 건 닉네임이므로 그 폭을 닉네임에 준다. */}
                  <strong>{entry.nickname}</strong>
                  <span className="score-value">
                    {/* 좁은 화면에서 STAGE 배지는 아래로 내려가도 되지만
                        숫자와 '점'은 항상 붙어 있어야 한다 */}
                    <span className="score-number">
                      {entry.score.toLocaleString()}
                      <small>점</small>
                    </span>
                    {entry.stage_reached ? (
                      <em className="stage-tag">STAGE {entry.stage_reached}</em>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </div>

          {entries && entries.length > 0 ? (
            <div className="ranking-card-cta">
              <button
                className="ranking-challenge-button"
                onClick={() => navigate(`${gamePath}?difficulty=${encodeURIComponent(difficulty)}`)}
              >
                <GamepadIcon size={18} />
                <span>{selectedGame.label} 도전하기</span>
              </button>
            </div>
          ) : null}
        </div>

        <p className="ranking-footnote">점수 동률 시 먼저 달성한 순서로 순위가 정해져요.</p>

        {myRecords.length > 0 ? (
          <section className="my-records">
            <h2>내 최근 기록</h2>
            <div className="my-records-list">
              {myRecords.map((record) => (
                <div className="my-record" key={record.played_at}>
                  <span>{formatDate(record.played_at)}</span>
                  <strong>{record.score.toLocaleString()}점</strong>
                  {record.stage_reached ? <em>STAGE {record.stage_reached}</em> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

      </main>

      <AppFooter />
    </div>
  )
}
