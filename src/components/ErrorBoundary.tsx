import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('화면 렌더링 오류', { error, componentStack: info.componentStack })
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app-shell result-empty" role="alert">
        <h1>화면을 불러오지 못했어요</h1>
        <p>페이지를 새로고침하거나 메인 화면으로 돌아가 다시 시도해 주세요.</p>
        <button className="button button--primary" onClick={() => window.location.assign('/')}>
          메인으로
        </button>
      </main>
    )
  }
}
