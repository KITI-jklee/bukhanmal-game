import { useEffect } from 'react'
import { AcidRain } from './pages/AcidRain'
import { Admin } from './pages/Admin'
import { Chosung } from './pages/Chosung'
import { Home } from './pages/Home'
import { Ranking } from './pages/Ranking'
import { Result } from './pages/Result'
import { trackPageView } from './lib/eventApi'
import { useViewportMetrics } from './lib/useViewport'
import { useLocation, useNavigate } from './lib/router'

export default function App() {
  useViewportMetrics()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!['/', '/acid-rain', '/chosung', '/result', '/ranking', '/admin'].includes(pathname)) {
      navigate('/', { replace: true })
    }
  }, [pathname, navigate])

  // 앱이 브라우저에서 뜰 때 한 번만 방문자 수를 센다 — SPA 내부 이동(라우팅)은 페이지 재로드가 아니라서 여기서 다시 안 잡힌다(의도한 동작, eventApi.ts 참고).
  useEffect(() => {
    trackPageView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let page: React.ReactNode
  if (pathname === '/') page = <Home />
  else if (pathname === '/acid-rain') page = <AcidRain />
  else if (pathname === '/chosung') page = <Chosung />
  else if (pathname === '/result') page = <Result />
  else if (pathname === '/ranking') page = <Ranking />
  else if (pathname === '/admin') page = <Admin />
  else page = null

  if (page === null) {
    return null
  }

  return page
}
