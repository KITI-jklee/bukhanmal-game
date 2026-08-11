/** 관리자 통계 화면 — 발주처가 Vercel 대시보드에 접근할 수 없어서, 방문자
 * 수·게임 이용 횟수를 앱 안에서 직접 보여준다. 비밀번호 하나로만 보호한다
 * (회원가입/계정 시스템 없음 — 내부 지표 총계만 노출하는 용도라 이 정도로
 * 충분하다고 판단).
 *
 * 비밀번호는 세션스토리지에만 잠깐 저장한다(탭 닫으면 사라짐) — 매 새로고침
 * 마다 다시 치게 하면 실제로 쓰지 않을 것 같아서 최소한의 편의만 남겼다. */

import { useEffect, useState } from 'react'
import { AppFooter } from '../components/AppFooter'
import { AppHeader } from '../components/AppHeader'
import { AdminAuthError, fetchStats } from '../lib/adminApi'
import type { StatsResponse } from '../lib/types'
import './Admin.css'

const SESSION_KEY = 'tongil.admin_password'

function readSessionPassword(): string {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeSessionPassword(password: string): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, password)
  } catch {
    /* 세션스토리지가 막혀도(사파리 프라이빗 모드 등) 화면은 계속 동작해야 한다 */
  }
}

export function Admin() {
  const [password, setPassword] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = (candidate: string) => {
    setLoading(true)
    setError(null)
    fetchStats(candidate)
      .then((result) => {
        setStats(result)
        setPassword(candidate)
        writeSessionPassword(candidate)
      })
      .catch((err: unknown) => {
        if (err instanceof AdminAuthError) {
          setError('비밀번호가 올바르지 않습니다.')
        } else {
          setError('통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
        }
        setStats(null)
      })
      .finally(() => setLoading(false))
  }

  // 이전에 입력해둔 비밀번호가 세션에 남아 있으면 바로 조회를 시도한다.
  useEffect(() => {
    const saved = readSessionPassword()
    if (saved) load(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!inputValue.trim()) return
    load(inputValue.trim())
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="admin-content">
        <h1>관리자 통계</h1>
        <p>방문자 수와 게임 이용 횟수 총계입니다.</p>

        {!stats ? (
          <form className="admin-login" onSubmit={submit}>
            <input
              type="password"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="비밀번호"
              autoFocus
            />
            <button className="button button--primary" type="submit" disabled={loading}>
              {loading ? '확인 중…' : '확인'}
            </button>
            {error ? <p className="admin-login-error">{error}</p> : null}
          </form>
        ) : (
          <>
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="stat-label">방문자 수</div>
                <div className="stat-value">{stats.total_page_views.toLocaleString()}</div>
              </div>
              <div className="admin-stat-card">
                <div className="stat-label">게임 이용 횟수</div>
                <div className="stat-value">{stats.total_game_starts.toLocaleString()}</div>
              </div>
              <div className="admin-stat-card">
                <div className="stat-label">순 이용자 수</div>
                <div className="stat-value">{stats.unique_players.toLocaleString()}</div>
              </div>
              <div className="admin-stat-card">
                <div className="stat-label">이용률 (게임 이용 횟수 ÷ 방문자 수)</div>
                <div className="stat-value">
                  {stats.usage_rate_percent === null ? '-' : `${stats.usage_rate_percent}%`}
                </div>
              </div>
              <div className="admin-stat-card admin-stat-card--wide">
                <div className="stat-label">게임별 이용 횟수</div>
                <div className="admin-stat-breakdown">
                  <div>
                    초성게임
                    <strong>{stats.game_starts_by_game.chosung.toLocaleString()}</strong>
                  </div>
                  <div>
                    산성비게임
                    <strong>{stats.game_starts_by_game.acid_rain.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>
            <button
              className="button button--ghost admin-refresh"
              onClick={() => load(password)}
              disabled={loading}
            >
              {loading ? '새로고침 중…' : '새로고침'}
            </button>
          </>
        )}
      </main>

      <AppFooter />
    </div>
  )
}
