// =============================================================
// statementFeed.js — 경영진 발언 카드의 '발언' 탭 목록 (순수 함수 — 화면 ui/StatementsCard.jsx 는 그리기만)
// -------------------------------------------------------------
// 달별 묶음 (최신 달 먼저, 달 안도 최신순) — Linear 변경 기록처럼 왼쪽에 달, 오른쪽에 발언
// 발언 한 줄 = 발언 칸들 + promises(약속 칩 목록: 약속 · 판정 · repeat = 앞서 같은 약속을 말한 적 있음) + beforeSince
//   한 문장에 약속이 둘이면(같은 사람·주소·인용) 한 줄로 합쳐 칩을 둘 붙임 (예전 목록은 같은 인용이 두 줄이었음)
// 약속만 모아 보는 화면은 '약속' 탭(promiseTimeline.js)이 따로 맡음 → 여기 거르기는 채널·사람만
// =============================================================
import { verdictOf } from './promises.js'

// 채널 단추 순서 (release = 보도자료 속 CEO 인용)
export const FEED_CHANNELS = ['x', 'call', 'interview', 'release']

// 최신순 (같은 날이면 id 순 — 화면 순서가 늘 같게)
const newestFirst = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id))

// channel: 'all' | FEED_CHANNELS 중 하나 · person: 사람 id 를 주면 그 사람 발언만
export function statementFeed(file, { channel = 'all', person = null } = {}) {
  const promises = new Map(file.promises.map((p) => [p.id, p]))
  // 약속마다 처음 말한 발언 id (날짜가 이른 순, 같은 날이면 id 순) — 그 뒤 발언의 칩은 '다시 언급'
  const firstOf = new Map()
  for (const s of [...file.statements].sort((a, b) => -newestFirst(a, b))) if (s.promise && !firstOf.has(s.promise)) firstOf.set(s.promise, s.id)

  const keep = (s) => (!person || s.person === person) && (channel === 'all' || s.channel === channel)
  const list = [], byQuote = new Map() // byQuote: 같은 문장(사람·주소·인용) → 이미 만든 줄
  for (const s of file.statements.filter(keep).sort(newestFirst)) {
    const p = s.promise ? promises.get(s.promise) : null
    const chip = p ? { promise: p, verdict: verdictOf(p, file.checkedAt), repeat: firstOf.get(p.id) !== s.id } : null
    const key = s.quote ? `${s.person}|${s.url}|${s.quote}` : null
    const twin = key ? byQuote.get(key) : null
    if (twin) { // 같은 문장 — 칩만 더함
      if (chip && !twin.promises.some((c) => c.promise.id === chip.promise.id)) twin.promises.push(chip)
      continue
    }
    const { promise: _id, ...rest } = s // 약속 id 칸은 칩으로 바꿔 담음
    const item = { ...rest, beforeSince: s.date < file.since, promises: chip ? [chip] : [] }
    list.push(item)
    if (key) byQuote.set(key, item)
  }
  // 달별 묶음 (list 가 이미 최신순이라 달도 최신순으로 쌓임)
  const months = []
  for (const it of list) {
    const month = it.date.slice(0, 7)
    if (months.at(-1)?.month !== month) months.push({ month, items: [] })
    months.at(-1).items.push(it)
  }
  return months
}

// 화면에 보일 채널 단추: '전체' + 발언이 하나라도 있는 채널 (person 을 주면 그 사람 발언 기준)
export function feedChannels(file, person = null) {
  const has = new Set(file.statements.filter((s) => !person || s.person === person).map((s) => s.channel))
  return ['all', ...FEED_CHANNELS.filter((c) => has.has(c))]
}
