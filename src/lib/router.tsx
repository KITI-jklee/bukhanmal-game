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

type Navigate = (to: string, options?: NavigateOptions) => void
type SetSearchParams = (params: Record<string, string>) => void

const RouterContext = createContext<{
  location: AppLocation
  navigate: Navigate
} | null>(null)

function readLocation(): AppLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    state: window.history.state,
  }
}

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const update = () => setLocation(readLocation())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  const navigate = useCallback<Navigate>((to, options = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState'
    window.history[method](options.state ?? null, '', to)
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
