/* 난이도 선택 모달 — FR-CM-02 시안의 문구는 "난이도가 높을수록 제한 시간이 짧아져요"였으나, 기획서 4-2는 선택 난이도가 출제 단어은행과 기본점수만 결정하고 낙하 속도는 스테이지가 올린다고 명시한다. */

import { useEffect, useRef, useState } from 'react'
import type { Difficulty, GameId } from '../lib/types'
import { QUESTIONS_PER_ROUND, TIME_LIMIT_SECONDS } from '../game/chosungConfig'
import { CheckIcon, CloseIcon, InfoIcon } from './Icons'
import './DifficultyDialog.css'
import { useDialogFocus } from '../lib/useDialogFocus'

interface Option {
  level: Difficulty
  title: string
  /** 출제 단어 기준은 게임마다 다르다 — 상세기획서 3-2(초성) / 4-2(산성비) */
  description: Record<GameId, string>
  badgeTone: 'mint' | 'amber' | 'red'
  tag?: string
}

const OPTIONS: Option[] = [
  {
    level: '쉬움',
    title: '차근차근',
    description: {
      chosung: '짧고 일상적이며 친숙한 단어',
      acid_rain: '일상적이고 쉽게 추론되는 단어',
    },
    badgeTone: 'mint',
    tag: '초보 추천',
  },
  {
    level: '보통',
    title: '한 걸음 더',
    description: {
      chosung: '다소 생소하거나 추론이 필요한 단어',
      acid_rain: '다소 생소하고 표현 차이가 있는 단어',
    },
    badgeTone: 'amber',
  },
  {
    level: '어려움',
    title: '실력 겨루기',
    description: {
      chosung: '길거나 전문적이고 매우 생소한 단어',
      acid_rain: '전문적이거나 표현 차이가 큰 단어',
    },
    badgeTone: 'red',
  },
]

interface Props {
  game: GameId
  onClose: () => void
  onStart: (difficulty: Difficulty) => void
}

export function DifficultyDialog({ game, onClose, onStart }: Props) {
  const [selected, setSelected] = useState<Difficulty>('보통')
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const gameLabel = game === 'chosung' ? '초성게임' : '산성비게임'

  return (
    <div className="dialog-scrim" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="difficulty-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="난이도 선택"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <span className="dialog-kicker">{gameLabel}</span>
            <h3>난이도를 선택하세요</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기" data-dialog-close>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="difficulty-list" role="radiogroup" aria-label="난이도">
          {OPTIONS.map((option) => (
            <button
              key={option.level}
              role="radio"
              aria-checked={selected === option.level}
              className={`difficulty-option${selected === option.level ? ' is-selected' : ''}`}
              onClick={() => setSelected(option.level)}
            >
              {/* 추천 배지는 배지 옆에 둔다. 카드 하단에 절대배치하면
                  설명 줄 수에 따라 글자와 겹친다. */}
              <span className="difficulty-head">
                <span className={`level-badge level-badge--${option.badgeTone}`}>
                  {option.level}
                </span>
                {option.tag ? <span className="difficulty-tag">{option.tag}</span> : null}
              </span>
              <span className="difficulty-copy">
                <strong>{option.title}</strong>
                <small>{option.description[game]}</small>
              </span>
              <span className="radio-mark" aria-hidden="true">
                {selected === option.level ? <CheckIcon size={11} /> : null}
              </span>
            </button>
          ))}
        </div>

        <p className="dialog-note">
          <InfoIcon size={14} />
          <span>
            {game === 'chosung'
              ? `한 판 ${QUESTIONS_PER_ROUND}문제, 문제당 ${TIME_LIMIT_SECONDS}초예요. 어려운 난이도일수록 점수가 높아져요.`
              : '초록색 북한말에는 남한말을, 노란색 남한말에는 북한말을 입력하세요.'}
          </span>
        </p>

        <div className="dialog-actions">
          <button className="button button--ghost" onClick={onClose}>
            닫기
          </button>
          <button className="button button--primary" onClick={() => onStart(selected)}>
            이 난이도로 시작
          </button>
        </div>
      </div>
    </div>
  )
}
