/* oxlint-disable react/only-export-components -- 라우터 Provider와 전용 훅은 같은 Context를 공유한다. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface AppLocation {
  pathname: string
  search: string
  state: unknown
}

interface NavigateOptions {
  replace?: boolean
  state?: unknown
}

interface MobileRouteState {
  __mobileRoute: true
  pathname: string
  search: string
  pageState: unknown
}

type Navigate = (to: string, options?: NavigateOptions) => void
type SetSearchParams = (params: Record<string, string>) => void

const RouterContext = createContext<{
  location: AppLocation
  navigate: Navigate
} | null>(null)

function isMobile(): boolean {
  return window.matchMedia?.('(max-width: 768px)').matches ?? false
}

function isReload(): boolean {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return navigation?.type === 'reload'
}

function isMobileRouteState(value: unknown): value is MobileRouteState {
  if (!value || typeof value !== 'object') return false
  return (value as Partial<MobileRouteState>).__mobileRoute === true
}

function readLocation(ignoreMobileRoute = false): AppLocation {
  const routeState = window.history.state

  if (isMobile() && !ignoreMobileRoute && isMobileRouteState(routeState)) {
    return {
      pathname: routeState.pathname,
      search: routeState.search,
      state: routeState.pageState,
    }
  }

  return {
    pathname: isMobile() && ignoreMobileRoute ? '/' : window.location.pathname,
    search: isMobile() && ignoreMobileRoute ? '' : window.location.search,
    state: isMobile() && ignoreMobileRoute ? null : routeState,
  }
}

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  const resetMobileRoute = isMobile() && isReload()
  const [location, setLocation] = useState(() => readLocation(resetMobileRoute))

  useEffect(() => {
    const update = () => setLocation(readLocation())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  useEffect(() => {
    if (!resetMobileRoute) return
    window.history.replaceState(null, '', '/')
  }, [resetMobileRoute])

  const navigate = useCallback<Navigate>((to, options = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState'
    if (isMobile()) {
      const target = new URL(to, window.location.origin)
      const routeState: MobileRouteState = {
        __mobileRoute: true,
        pathname: target.pathname,
        search: target.search,
        pageState: options.state ?? null,
      }
      window.history[method](routeState, '', '/')
    } else {
      window.history[method](options.state ?? null, '', to)
    }
    setLocation(readLocation())
  }, [])

  const value = useMemo(() => ({ location, navigate }), [location, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

function useRouter() {
  const router = useContext(RouterContext)
  if (!router) throw new Error('Router hooks must be used inside BrowserRouter.')
  return router
}

export function useNavigate(): Navigate {
  return useRouter().navigate
}

export function useLocation(): AppLocation {
  return useRouter().location
}

export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const { location, navigate } = useRouter()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const setParams = useCallback<SetSearchParams>(
    (next) => {
      const search = new URLSearchParams(next).toString()
      navigate(`${location.pathname}${search ? `?${search}` : ''}`)
    },
    [location.pathname, navigate],
  )
  return [params, setParams]
}
