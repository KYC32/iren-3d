// "경영진 발언" 칸 목록 행 만들기 (statementRows.js) — 거르기·최신순·다시 언급·시작일 전·판정
import { it, expect } from 'vitest'
import { statementRows, visibleFilters } from './statementRows.js'
import { verdictOf } from './promises.js'
import file from './fixtures/statements.sample.json'

it('최신순', () => { const d = statementRows(file, 'all').map((r) => r.date); expect(d).toEqual([...d].sort().reverse()) })
it("'약속만' 은 약속에 걸린 발언만, 'x' 는 X 만", () => {
  expect(statementRows(file, 'promises').every((r) => r.promise)).toBe(true)
  expect(statementRows(file, 'x').every((r) => r.channel === 'x')).toBe(true)
})
it("'release' 는 보도자료 속 인용만 (샘플에 하나 이상)", () => {
  const rows = statementRows(file, 'release')
  expect(rows.length).toBeGreaterThan(0); expect(rows.every((r) => r.channel === 'release')).toBe(true)
})
it('거르기 단추: 샘플에는 여섯 개 모두 (전체 · 약속만 · X · 실적 발표 · 인터뷰 · 보도자료)', () => {
  expect(visibleFilters(file)).toEqual(['all', 'promises', 'x', 'call', 'interview', 'release'])
})
it('발언이 하나도 없는 채널의 단추는 숨김 (누르면 빈 목록만 나오므로) — 전체는 늘 보임', () => {
  const noX = { ...file, statements: file.statements.filter((s) => s.channel !== 'x') }
  expect(visibleFilters(noX)).toEqual(['all', 'promises', 'call', 'interview', 'release'])
  expect(visibleFilters({ ...file, statements: [] })).toEqual(['all'])
})
it('같은 약속의 뒤 발언은 repeatOf = 처음 날짜, 처음 발언에는 없음', () => {
  const rows = statementRows(file, 'all').filter((r) => r.promise?.id === 'p-sample-repeat')
  const first = rows.at(-1), later = rows[0]
  expect(first.repeatOf).toBeUndefined(); expect(later.repeatOf).toBe(first.date)
})
it('시작일 전 발언은 beforeSince', () => expect(statementRows(file, 'all').filter((r) => r.date < file.since).every((r) => r.beforeSince)).toBe(true))
it('판정은 checkedAt 기준으로 붙음', () => {
  const r = statementRows(file, 'promises')[0]; expect(r.verdict).toEqual(verdictOf(r.promise, file.checkedAt))
})
