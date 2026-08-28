/* 게임별 방법 안내 모달 규칙은 게임마다 완전히 달라서 하나의 안내 페이지에 모으면 사용자가 자기 게임 규칙을 골라 읽어야 한다. */

import { useEffect, useRef } from 'react'
import type { GameId } from '../lib/types'
import { TIME_STOP_DURATION, TIME_STOP_WORD } from '../game/acidRainConfig'
import { BulbIcon, ClockIcon, CloseIcon, HeartIcon, ShieldIcon, ZapIcon } from './Icons'
import './GameGuideDialog.css'
import { useDialogFocus } from '../lib/useDialogFocus'

interface Props {
  game: GameId
  onClose: () => void
  onStart?: () => void
}

export function GameGuideDialog({ game, onClose, onStart }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const title = game === 'acid_rain' ? '남북한말 산성비게임' : '북한말 초성게임'

  return (
    <div className="dialog-scrim" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} 게임 방법`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-dialog-head">
          <div>
            <span className="dialog-kicker">HOW TO PLAY</span>
            <h3>{title}</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="guide-dialog-body">
          {game === 'acid_rain' ? <AcidRainGuide /> : <ChosungGuide />}
        </div>

        <div className="guide-dialog-actions">
          {onStart ? (
            <button className="button button--primary" onClick={onStart}>
              바로 시작하기
            </button>
          ) : (
            <button className="button button--ghost" onClick={onClose}>
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AcidRainGuide() {
  return (
    <>
      <section>
        <h4>떨어지는 단어의 짝을 입력하세요</h4>
        <div className="color-guide">
          <div className="color-row">
            <span className="color-chip color-chip--green">북한말</span>
            <p>
              뜻이 같은 <b>남한말</b> 입력 · 손기척 → 노크
            </p>
          </div>
          <div className="color-row">
            <span className="color-chip color-chip--yellow">남한말</span>
            <p>
              뜻이 같은 <b>북한말</b> 입력 · 도시락 → 곽밥
            </p>
          </div>
          <div className="color-row">
            <span className="color-chip color-chip--red">{TIME_STOP_WORD}</span>
            <p>
              <b>'시간정지'</b> 입력 → {TIME_STOP_DURATION}초간 화면이 멈춰요.
            </p>
          </div>
        </div>
      </section>

      <section className="guide-rule-summary" aria-label="게임 핵심 규칙">
        <p>
          <ShieldIcon size={16} />
          <span>
            단어를 놓치면 방어 게이지가 줄어들고, <b>모두 소진되면 게임이 끝나요.</b>
          </span>
        </p>
        <p>
          <ZapIcon size={16} />
          <span>
            연속으로 맞히면 <b>콤보가 쌓여 더 높은 점수</b>를 얻어요.
          </span>
        </p>
      </section>
    </>
  )
}

/* 산성비게임 안내와 같은 형식(칩 + 한 줄 설명)으로 맞췄다. */
function ChosungGuide() {
  return (
    <>
      <section>
        <h4>초성과 뜻풀이를 보고 북한말을 맞혀요</h4>
        <div className="color-guide">
          <div className="color-row">
            <span className="color-chip color-chip--quiz">ㄱ ㅂ</span>
            <p>한 끼 식사를 담아 다니는 음식</p>
          </div>
        </div>
        <p className="guide-answer">
          정답은 <b>곽밥</b> — 남한말로는 도시락이에요.
        </p>
      </section>

      <section>
        <h4>모르겠다면 힌트를 두 번까지 쓸 수 있어요</h4>
        <div className="color-guide">
          <div className="color-row">
            <span className="color-chip color-chip--hint">힌트 1</span>
            <p>
              같은 뜻의 <b>남한말</b>을 알려줘요 · ㄱㅂ → 도시락
            </p>
          </div>
          <div className="color-row">
            <span className="color-chip color-chip--hint2">힌트 2</span>
            <p>
              <b>첫 글자</b>를 알려줘요 · ㄱㅂ → 곽ㅂ
            </p>
          </div>
        </div>
      </section>

      <section className="guide-rule-summary" aria-label="게임 핵심 규칙">
        <p>
          <ClockIcon size={16} />
          <span>
            한 판은 <b>10문제</b>, 문제당 <b>20초</b>예요.
          </span>
        </p>
        <p>
          <HeartIcon size={16} filled={false} />
          <span>
            문제당 <b>하트 3개</b>! 틀리면 1개씩 줄고, 모두 소진되면 점수 없이 다음 문제로 넘어가요.
          </span>
        </p>
        <p>
          <BulbIcon size={16} filled={false} />
          <span>
            힌트를 사용하면 획득할 수 있는 점수가 줄어들어요.
          </span>
        </p>
      </section>
    </>
  )
}
