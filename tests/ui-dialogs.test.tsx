// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DifficultyDialog } from '../src/components/DifficultyDialog'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { NicknameDialog } from '../src/components/NicknameDialog'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('사용자 다이얼로그 흐름', () => {
  it('난이도를 선택해 게임 시작 콜백으로 전달한다', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<DifficultyDialog game="chosung" onClose={vi.fn()} onStart={onStart} />)

    const choices = screen.getAllByRole('radio')
    expect(choices).toHaveLength(3)
    expect(choices[1].getAttribute('aria-checked')).toBe('true')
    await user.click(choices[2])
    expect(choices[2].getAttribute('aria-checked')).toBe('true')
    await user.click(screen.getAllByRole('button').at(-1)!)
    expect(onStart).toHaveBeenCalledWith('어려움')
  })

  it('Escape 키로 난이도 선택을 닫는다', () => {
    const onClose = vi.fn()
    render(<DifficultyDialog game="acid_rain" onClose={onClose} onStart={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('닉네임 오류를 표시하고 정규화된 값을 저장한다', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<NicknameDialog onDone={onDone} />)
    const input = screen.getByRole('textbox')

    await user.type(input, '!!!')
    await user.click(screen.getByRole('button'))
    expect(onDone).not.toHaveBeenCalled()
    expect(document.querySelector('.nickname-error')).not.toBeNull()

    await user.clear(input)
    await user.type(input, '  통일   게임  ')
    await user.click(screen.getByRole('button'))
    expect(onDone).toHaveBeenCalledWith('통일 게임')
    expect(window.localStorage.getItem('tongil.nickname')).toBe('통일 게임')
  })
})

describe('오류 대체 화면', () => {
  it('자식 렌더링 오류를 사용자 안내 화면으로 전환한다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): never { throw new Error('boom') }
    render(<ErrorBoundary><Broken /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toBeDefined()
  })
})
