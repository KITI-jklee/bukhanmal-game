import { useEffect } from 'react'
import { AcidRain } from './pages/AcidRain'
import { Chosung } from './pages/Chosung'
import { Home } from './pages/Home'
import { Ranking } from './pages/Ranking'
import { Result } from './pages/Result'
import { useViewportMetrics } from './lib/useViewport'
import { useLocation, useNavigate } from './lib/router'

export default function App() {
  useViewportMetrics()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!['/', '/acid-rain', '/chosung', '/result', '/ranking'].includes(pathname)) {
      navigate('/', { replace: true })
    }
  }, [pathname, navigate])

  let page: React.ReactNode
  if (pathname === '/') page = <Home />
  else if (pathname === '/acid-rain') page = <AcidRain />
  else if (pathname === '/chosung') page = <Chosung />
  else if (pathname === '/result') page = <Result />
  else if (pathname === '/ranking') page = <Ranking />
  else page = null

  if (page === null) {
    return null
  }

  return page
}
