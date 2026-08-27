/** 정답 판정 — 상세기획서 3-5 / 4-4
 *
 * 입력을 정규화한 뒤 비교할 때는 UX를 위해 모든 공백을 제거하고 허용 정답 배열과
 * 완전일치하는지 판정한다. 편집거리는 정답으로 인정하지 않고 "거의 맞았어요"
 * 안내에만 쓴다. */

/** 공백 정규화. 판정 전 양쪽이 모두 이 함수를 거친다. */
export function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** 비교용 정규화 — 띄어쓰기 차이는 데이터의 accepted_answers로 흡수하지만,
 *  같은 표기의 공백 유무까지 오답 처리하면 체감이 나빠 비교 시에는 공백을 제거한다. */
function compact(value: string): string {
  return normalize(value).replace(/\s/g, '')
}

/** 빈 문자열·공백만·특수문자만 있는 값은 제출로 보지 않는다(FR-CM-07).
 *
 * 한글 자모 범위는 현대 한글 자모(ㄱ-ㅎ, ㅏ-ㅣ)뿐 아니라 옛한글 등에 쓰이는
 * 나머지 호환용 자모(ㆍ-ㆎ 등)까지 포함한 ㄱ-ㆎ 전체를 허용한다 — 더 넓은
 * 쪽이 유효한 한글 입력을 놓치지 않는다(초성게임·산성비게임 공통, 두 게임
 * 다 원래 이 범위 안에서만 정답을 받으므로 동작에 영향이 없다). */
export function isSubmittable(value: string): boolean {
  const trimmed = normalize(value)
  if (trimmed.length === 0) return false
  return /[가-힣ㄱ-ㆎa-zA-Z0-9]/.test(trimmed)
}

/** 허용 정답 배열과 완전일치하는지 */
export function isCorrect(input: string, acceptedAnswers: string[]): boolean {
  const target = compact(input)
  if (!target) return false
  return acceptedAnswers.some((answer) => compact(answer) === target)
}

/** 레벤슈타인 편집거리 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev.splice(0, prev.length, ...curr)
  }
  return prev[b.length]
}

/** 편집거리 1인 오답인지 — 정답 처리는 하지 않고 피드백 문구에만 사용 */
export function isNearMiss(input: string, acceptedAnswers: string[]): boolean {
  const target = compact(input)
  if (target.length < 2) return false
  return acceptedAnswers.some((answer) => editDistance(compact(answer), target) === 1)
}
