// =============================================================
// narration.js — 영상 내레이션(읽을 문장) 검사와 소리 조각 놓기 (순수 함수, narration.test.js)
// -------------------------------------------------------------
// 읽을 문장은 storyboard.js 의 NARRATION 에 있습니다 (자막은 같은 파일의 buildCards — 자료로 만듦).
//   checkNarration: 그 시간대 화면 자막에 없는 숫자를 말하지 않는지 · 이름을 한글로 썼는지 · 시각이 맞는지
//     (번역 검사기 translateGuard 와 같은 생각: 기계가 만든 소리는 숫자를 틀리기 쉬우니 글부터 묶어 둠)
//   placeClips: 문장마다 만든 소리 조각(초)을 시간표에 놓음 — t0 에서 시작, 앞 조각이 길면 이어서,
//     t1 을 넘기면 최대 MAX_SPEED 배까지 빠르게. 그래도 넘치면 문제로 알림(문장을 줄여야 함)
// 소리 만들기·합치기는 scripts/narrate/narrate.mjs (Qwen3-TTS 'Sohee')
// =============================================================

export const GAP = 0.15        // 앞 조각과 이어 붙일 때 쉬는 시간(초)
export const MAX_SPEED = 1.15  // 이보다 빠르게 하면 말이 급하게 들림

// 영어 낱말 중 그대로 둬도 되는 것 (TTS 가 자연스럽게 읽음)
const LATIN_OK = new Set(['AI'])

// 글 속 숫자: "2026.08" 같은 날짜는 해·달 둘로, "1,474" 는 천 단위 쉼표를 빼고, 소수는 그대로
export function numbersOf(text) {
  const s = String(text ?? '')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d{4})\.(\d{2})(?!\d)/g, '$1 $2')
  return (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
}

// 자막 카드 하나에 적힌 모든 글 (제목·부제·본문·숫자 칸·안내)
const cardText = (c) => [c.title, c.sub, c.text, c.note, ...(c.stats ?? [])].filter(Boolean).join(' ')

/**
 * @param {Array} cards     storyboard.buildCards(data, lang)
 * @param {Array} lines     storyboard NARRATION[lang] — { t0, t1, say }
 * @param {number} duration 영상 길이(초)
 * @returns {string[]} 문제 목록 (빈 배열이면 통과)
 */
export function checkNarration(cards, lines, duration) {
  const problems = []
  lines.forEach((ln, i) => {
    const tag = `#${i + 1} "${ln.say}"`
    if (!(ln.t1 > ln.t0)) problems.push(`${tag}: 끝(t1)이 시작(t0)보다 빠름`)
    if (ln.t0 < 0 || ln.t1 > duration) problems.push(`${tag}: 영상 밖 (0~${duration}초)`)
    if (i > 0 && ln.t0 < lines[i - 1].t0) problems.push(`${tag}: 앞 문장보다 먼저 시작함`)
    const latin = (ln.say.match(/[A-Za-z]+/g) ?? []).filter((w) => !LATIN_OK.has(w))
    if (latin.length) problems.push(`${tag}: 영어 글자(${latin.join(', ')}) — 한글로 적어야 TTS 가 이름으로 읽음`)
    // 그 시간대에 화면에 떠 있는 자막의 숫자만 말할 수 있음
    const shown = new Set(cards.filter((c) => c.t0 < ln.t1 && c.t1 > ln.t0).flatMap((c) => numbersOf(cardText(c))))
    for (const n of new Set(numbersOf(ln.say))) if (!shown.has(n)) problems.push(`${tag}: 숫자 ${n} 이(가) 그 시간 자막에 없음`)
  })
  return problems
}

/**
 * @param {Array<{t0:number,t1:number,say?:string}>} items  읽을 문장 (시간표)
 * @param {number[]} durations  문장마다 만든 소리 길이(초, 앞뒤 무음을 뺀 값)
 * @returns {{ clips: Array<{start:number,speed:number,end:number}>, problems: string[] }}
 */
export function placeClips(items, durations) {
  const clips = []
  const problems = []
  let prevEnd = -Infinity
  items.forEach((it, i) => {
    const dur = durations[i]
    const start = Math.max(it.t0, prevEnd + GAP)
    const room = it.t1 - start
    let speed = dur > room ? dur / room : 1
    if (room <= 0 || speed > MAX_SPEED) {
      problems.push(`#${i + 1} "${it.say ?? ''}": ${dur.toFixed(2)}초 — ${start.toFixed(2)}~${it.t1}초 안에 ${MAX_SPEED}배로도 안 들어감 (문장을 줄이세요)`)
      speed = MAX_SPEED
    }
    const end = start + dur / speed
    clips.push({ start, speed, end })
    prevEnd = end
  })
  return { clips, problems }
}
