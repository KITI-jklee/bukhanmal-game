/* 개발사 표기 푸터. */

import { useNavigate } from '../lib/router'

export function AppFooter() {
  const navigate = useNavigate()

  return (
    <footer className="app-footer">
      {/* 저작권 문구 자체가 관리자 통계 화면 진입점이다 — "관리자" 같은 라벨을
          따로 두지 않고, 알고 찾아 들어가는 사람만 쓰게 한다(어차피 비밀번호로
          보호됨). 그래서 겉보기엔 그냥 평범한 텍스트처럼 보이게 스타일을
          그대로 둔다. */}
      <button type="button" className="kiti-credit" onClick={() => navigate('/admin')}>
        © KITI (주)한국정보화기술원
      </button>
    </footer>
  )
}
