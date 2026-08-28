/* 닉네임 입력 — 결과 화면마다 뜨며, 저장된 닉네임이 있으면 미리 채워둔다. */

import { useRef, useState } from 'react'
import { MAX_NICKNAME_LENGTH } from '../lib/constants'
import { normalizeNickname, setNickname, validateNickname } from '../lib/storage'
import { useDialogFocus } from '../lib/useDialogFocus'

interface Props {
  onDone: (nickname: string) => void
  onSkip?: () => void
  /** 브라우저에 저장된 닉네임. 있으면 입력칸에 미리 채운다. */
  initialValue?: string
}

export function NicknameDialog({ onDone, onSkip, initialValue = '' }: Props) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  useDialogFocus(dialogRef)
  const isEditing = initialValue.length > 0

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault()
    const message = validateNickname(value)
    if (message) {
      setError(message)
      return
    }
    const nickname = normalizeNickname(value)
    setNickname(nickname)
    onDone(nickname)
  }

  return (
    <div className="overlay" role="presentation">
      <form
        ref={dialogRef}
        className="overlay-card"
        role="dialog"
        aria-modal="true"
        aria-label="닉네임 입력"
        onSubmit={submit}
      >
        <h3>랭킹에 등록할 닉네임</h3>
        <p>
          회원가입 없이 닉네임만으로 참여합니다.
          <br />
          {isEditing ? (
            '그대로 완료를 누르면 이 닉네임으로, 바꾸면 새 닉네임으로 등록돼요.'
          ) : (
            '입력한 닉네임은 다음 게임에서도 기본값으로 채워져요.'
          )}
        </p>
        <input
          className="nickname-input"
          value={value}
          maxLength={MAX_NICKNAME_LENGTH}
          autoFocus
          placeholder={`${MAX_NICKNAME_LENGTH}자 이내`}
          // 바꿀 때 지우고 다시 치는 대신 바로 덮어쓸 수 있게 전체 선택해둔다
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          // 폼 기본 제출에만 기대지 않고 Enter를 명시적으로 처리한다.
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
            event.preventDefault()
            submit()
          }}
        />
        {error ? <p className="nickname-error">{error}</p> : null}
        <div className="overlay-actions">
          <button type="submit" className="button button--primary">
            완료
          </button>
          {onSkip ? (
            <button type="button" className="button button--ghost" onClick={onSkip}>
              다음에 하기
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
