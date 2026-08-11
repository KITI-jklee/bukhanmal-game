import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import { BrowserRouter } from './lib/router'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/tokens.css'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
        {/* 방문자 수(페이지뷰) 집계 — Vercel 대시보드에서 확인. 게임 이용
            횟수는 별개로 백엔드 game_events 테이블에 쌓는다(eventApi.ts). */}
        <Analytics />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
