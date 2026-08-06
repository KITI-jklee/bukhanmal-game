/** 개발사 표기 푸터.
 *
 * 게임 화면(초성·산성비)은 화면 전체를 쓰는 고정 높이 레이아웃이라 붙이지 않고,
 * 스크롤되는 콘텐츠 화면(메인·랭킹·결과)의 맨 아래에만 둔다. */

export function AppFooter() {
  return (
    <footer className="app-footer">
      {/* 한 덩어리 텍스트라 크기·굵기가 섞이지 않아 높이가 어긋날 일이 없다 */}
      <small className="kiti-credit">© KITI (주)한국정보화기술원</small>
    </footer>
  )
}
