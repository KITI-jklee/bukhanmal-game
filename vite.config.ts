import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      // 운영 CSP(public/_headers)는 connect-src를 https:로만 열어둔다.
      // 로컬 개발은 백엔드를 http://127.0.0.1:8000 같은 평범한 HTTP로
      // 띄우므로, dev 서버에서만 로컬 백엔드 접속을 추가로 허용한다.
      // 이 헤더는 `vite dev`에만 적용되고 `vite build` 결과물(dist)에는
      // 들어가지 않는다 — 운영 배포 시 정책은 그대로 _headers가 담당한다.
      //
      // script-src에 unsafe-inline·unsafe-eval이 필요한 이유: Vite dev
      // 서버가 React Fast Refresh(HMR)용 인라인 <script>를 문서 맨 앞에
      // 직접 주입한다. 이 헤더는 문서 파싱 시작부터 바로 적용되기 때문에
      // (meta 태그와 달리) 인라인 스크립트를 막으면 그 주입 스크립트부터
      // 차단되어 "plugin-react can't detect preamble" 에러로 화면이 아예
      // 안 뜬다. 프로덕션 빌드에는 이런 인라인 스크립트가 없으므로
      // public/_headers는 그대로 엄격하게 둔다.
      'Content-Security-Policy':
        "default-src 'self'; base-uri 'self'; object-src 'none'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; form-action 'self'; " +
        "connect-src 'self' https: ws: http://127.0.0.1:* http://localhost:*",
    },
  },
})
