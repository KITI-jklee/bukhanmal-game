import { useLocation, useNavigate } from '../lib/router'

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span>통</span>
    </span>
  )
}

export function AppHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // 게임 방법은 게임마다 규칙이 달라 전역 메뉴가 아니라 각 게임 카드의 모달로 연다
  const links = [
    { label: '게임', path: '/' },
    { label: '랭킹', path: '/ranking' },
  ]

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button className="brand-lockup" onClick={() => navigate('/')} aria-label="메인으로">
          <BrandMark />
          <strong className="brand-name">통일 워드게임</strong>
        </button>
        <nav className="app-nav" aria-label="게임 메뉴">
          {links.map((link) => (
            <button
              key={link.path}
              className={pathname === link.path ? 'is-active' : undefined}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
