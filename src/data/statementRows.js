// =============================================================
// statementRows.js — "경영진 발언" 칸의 목록 행 만들기 (순수 함수 — 화면은 이 행을 그리기만)
// -------------------------------------------------------------
// file  : data/statements.json 모양 (statementsSchema.js)
// filter: 'all' 전체 · 'promises' 약속만 · 'x' X · 'call' 실적 발표 · 'interview' 인터뷰
// 행마다: 발언 칸들 + 걸린 약속(promise)과 그 판정(verdict, 기준일 = file.checkedAt)
//   repeatOf    : 같은 약속을 이미 앞에서 말했으면 그 처음 날짜 ("다시 언급 · 처음 ○○")
//   beforeSince : 시작일(file.since) 전 발언 ("처음 약속 (시작일 전)")
// 정렬: 날짜 최신순
// =============================================================
import { verdictOf } from './promises.js'

export function statementRows(file, filter = 'all') {
  const promises = new Map(file.promises.map((p) => [p.id, p]))
  // 약속마다 가장 먼저 말한 날 (다시 언급 표시용)
  const firstSaid = new Map()
  for (const s of file.statements) if (s.promise && (!firstSaid.has(s.promise) || s.date < firstSaid.get(s.promise))) firstSaid.set(s.promise, s.date)

  const keep = (s) => filter === 'all' || (filter === 'promises' ? !!s.promise : s.channel === filter)
  return file.statements.filter(keep).map((s) => {
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
}
