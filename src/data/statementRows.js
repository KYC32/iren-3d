// =============================================================
// statementRows.js — "경영진 발언" 칸의 목록 행 만들기 (순수 함수 — 화면은 이 행을 그리기만)
// -------------------------------------------------------------
// file  : data/statements.json 모양 (statementsSchema.js)
// filter: 'all' 전체 · 'promises' 약속만 · 'x' X · 'call' 실적 발표 · 'interview' 인터뷰 · 'release' 보도자료
// 행마다: 발언 칸들 + 걸린 약속(promise)과 그 판정(verdict, 기준일 = file.checkedAt)
//   repeatOf    : 같은 약속을 이미 앞에서 말했으면 그 처음 날짜 ("다시 언급 · 처음 ○○")
//   beforeSince : 시작일(file.since) 전 발언 ("처음 약속 (시작일 전)")
// 정렬: 날짜 최신순
// =============================================================
import { verdictOf } from './promises.js'

// 거르기 단추 순서 (release = 보도자료 속 CEO 인용)
export const FILTERS = ['all', 'promises', 'x', 'call', 'interview', 'release']

// 화면에 보일 거르기 단추: 발언이 하나도 없는 단추는 숨김 (예: X 계정을 확인 못 해 X 발언이 0건)
//   '전체'는 늘 보임 — 목록이 비어도 단추 줄이 통째로 사라지지 않게
//   person: 사람별 카드면 그 사람 발언 기준
export function visibleFilters(file, person = null) {
  return FILTERS.filter((f) => f === 'all' || statementRows(file, f, person).length > 0)
}

// 화면에 보일 사람: 발언이 하나라도 있는 사람만 (자료 순서 그대로)
//   2026-10-21 사용자 결정: 발언이 없는 공동 CEO(Will Roberts)는 화면에서 뺌 — 자료(people)엔 남겨 두어 발언이 생기면 저절로 나타남
export function speakers(file) {
  const ids = new Set(file.statements.map((s) => s.person))
  return file.people.filter((p) => ids.has(p.id))
}

// person: 사람 id 를 주면 그 사람 발언만 (본사 3D 화면에서 CEO 배지를 눌렀을 때)
export function statementRows(file, filter = 'all', person = null) {
  const promises = new Map(file.promises.map((p) => [p.id, p]))
  // 약속마다 가장 먼저 말한 날 (다시 언급 표시용)
  const firstSaid = new Map()
  for (const s of file.statements) if (s.promise && (!firstSaid.has(s.promise) || s.date < firstSaid.get(s.promise))) firstSaid.set(s.promise, s.date)

  const keep = (s) => (!person || s.person === person) && (filter === 'all' || (filter === 'promises' ? !!s.promise : s.channel === filter))
  const rows = file.statements.filter(keep).map((s) => {
    const promise = s.promise ? promises.get(s.promise) : undefined
    const row = { ...s, beforeSince: s.date < file.since }
    if (promise) {
      row.promise = promise
      row.verdict = verdictOf(promise, file.checkedAt)
      const first = firstSaid.get(s.promise)
      if (first && first < s.date) row.repeatOf = first
    }
    return row
  }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)))
  // 한 문장에 약속이 둘이면 같은 인용이 두 줄 → 인용은 처음 보이는 줄에만, 나머지는 sameQuote 표시 ("위와 같은 문장")
  const shown = new Set()
  for (const r of rows) {
    if (!r.quote) continue
    const key = `${r.person}|${r.url}|${r.quote}`
    if (shown.has(key)) { delete r.quote; r.sameQuote = true } else shown.add(key)
  }
  return rows
}
