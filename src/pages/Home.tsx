import { useState } from 'react'
import { useNavigate } from '../lib/router'
import { AppFooter } from '../components/AppFooter'
import { AppHeader } from '../components/AppHeader'
import { DifficultyDialog } from '../components/DifficultyDialog'
import { GameGuideDialog } from '../components/GameGuideDialog'
import { ArrowRightIcon, BookIcon, ClockIcon, ShieldIcon } from '../components/Icons'
import { trackGameStart } from '../lib/eventApi'
import type { GameId } from '../lib/types'
import './Home.css'

export function Home() {
  const navigate = useNavigate()
  const [difficultyFor, setDifficultyFor] = useState<GameId | null>(null)
  const [guideFor, setGuideFor] = useState<GameId | null>(null)

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="home-content">
        <div className="home-intro">
          <span className="eyebrow">당신의 북한말 실력은 몇 점?</span>
          <h1>
            낯설지만 재미있는
            <br />
            북한말 세계
          </h1>
          <p>게임을 즐기며 북한말의 뜻과 표현을 알아보세요.</p>
        </div>

        <div className="game-card-grid">
          <article className="game-card">
            <div className="game-thumb game-thumb--initial" aria-hidden="true">
              <span className="thumb-chip">오늘의 북한말</span>
              <strong>ㄷㅈㅂ</strong>
              <span className="thumb-answer">도시락</span>
              <div className="thumb-timer">
                <span />
              </div>
            </div>
            <div className="game-card-body">
              <div>
                <span className="game-kicker">QUIZ</span>
                <span className="time-chip">
                  <ClockIcon size={11} /> 약 3~4분
                </span>
              </div>
              <h2>북한말 초성게임</h2>
              <p>초성과 뜻풀이를 보고 북한말을 맞혀보세요.</p>
              <button className="button button--primary" onClick={() => setDifficultyFor('chosung')}>
                시작하기 <ArrowRightIcon size={14} />
              </button>
              <button className="card-guide-link" onClick={() => setGuideFor('chosung')}>
                <BookIcon size={13} /> 게임 방법 보기
              </button>
            </div>
          </article>

          <article className="game-card">
            <div className="game-thumb game-thumb--rain" aria-hidden="true">
              <div className="rain-line rain-line--1">
                <span>북한말</span> 살림집
              </div>
              <div className="rain-line rain-line--2">
                <span>남한말</span> 주택
              </div>
              <div className="rain-line rain-line--3">
                <span>북한말</span> 손기척
              </div>
              <div className="thumb-defense">
                <ShieldIcon size={12} />
                <span />
              </div>
            </div>
            <div className="game-card-body">
              <div>
                <span className="game-kicker game-kicker--amber">TYPING</span>
                <span className="time-chip">
                  <ClockIcon size={11} /> 생존형
                </span>
              </div>
              <h2>남북한말 산성비게임</h2>
              <p>떨어지는 남북한 단어를 빠르게 입력하세요.</p>
              <button
                className="button button--primary"
                onClick={() => setDifficultyFor('acid_rain')}
              >
                시작하기 <ArrowRightIcon size={14} />
              </button>
              <button className="card-guide-link" onClick={() => setGuideFor('acid_rain')}>
                <BookIcon size={13} /> 게임 방법 보기
              </button>
            </div>
          </article>
        </div>

      </main>

      <AppFooter />

      {guideFor ? (
        <GameGuideDialog
          game={guideFor}
          onClose={() => setGuideFor(null)}
          onStart={() => {
            const game = guideFor
            setGuideFor(null)
            setDifficultyFor(game)
          }}
        />
      ) : null}

      {difficultyFor ? (
        <DifficultyDialog
          game={difficultyFor}
          onClose={() => setDifficultyFor(null)}
          onStart={(difficulty) => {
            trackGameStart(difficultyFor, difficulty)
            const path = difficultyFor === 'chosung' ? '/chosung' : '/acid-rain'
            navigate(`${path}?difficulty=${encodeURIComponent(difficulty)}`)
          }}
        />
      ) : null}
    </div>
  )
}
